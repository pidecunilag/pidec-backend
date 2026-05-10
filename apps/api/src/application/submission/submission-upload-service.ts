import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { ERROR_CODES } from '@pidec/shared';
import { getSupabaseService } from '../../infrastructure/db/supabase.js';
import { AppError } from '../../shared/errors/app-error.js';
import { platformReadService } from '../shared/platform-read-service.js';

const SUBMISSION_BUCKET = 'submissions';

export interface SubmissionUploadFile {
  id: string;
  url: string;
  filename: string;
  sizeBytes: number;
  mimetype: string;
  uploadedAt: string;
}

interface UploadRow {
  id: string;
  storage_path: string;
  filename: string;
  size_bytes: number;
  mimetype: string;
  created_at: string;
}

function safeFilename(filename: string) {
  const cleaned = path.basename(filename).replace(/[^\w.\- ()]/g, '_');
  return cleaned.slice(0, 160) || 'submission-file';
}

function toUploadFile(row: UploadRow): SubmissionUploadFile {
  return {
    id: row.id,
    url: row.storage_path,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    mimetype: row.mimetype,
    uploadedAt: row.created_at,
  };
}

export class SubmissionUploadService {
  private readonly supabase = getSupabaseService();

  async uploadFile(userId: string, stage: 2 | 3, file: Express.Multer.File) {
    const { team, edition } = await this.assertLeaderCanUpload(userId, stage);
    const filename = safeFilename(file.originalname);
    const storagePath = [
      edition.id,
      team.department.replace(/[^\w-]+/g, '_'),
      team.id,
      `stage-${stage}`,
      `${randomUUID()}-${filename}`,
    ].join('/');

    const { error: uploadError } = await this.supabase.storage
      .from(SUBMISSION_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data, error } = await this.supabase
      .from('submission_uploads')
      .insert([
        {
          team_id: team.id,
          edition_id: edition.id,
          stage,
          bucket: SUBMISSION_BUCKET,
          storage_path: storagePath,
          filename,
          size_bytes: file.size,
          mimetype: file.mimetype,
          uploaded_by: userId,
        },
      ] as never[])
      .select('id,storage_path,filename,size_bytes,mimetype,created_at')
      .single();

    if (error) {
      await this.supabase.storage.from(SUBMISSION_BUCKET).remove([storagePath]);
      throw error;
    }

    return toUploadFile(data as UploadRow);
  }

  async resolveFilesForSubmission(userId: string, stage: 2 | 3, fileIds: string[]) {
    if (fileIds.length === 0) return [];

    const { team, edition } = await this.assertLeaderCanUpload(userId, stage);
    const uniqueIds = Array.from(new Set(fileIds));

    const { data, error } = await this.supabase
      .from('submission_uploads')
      .select('id,storage_path,filename,size_bytes,mimetype,created_at')
      .in('id', uniqueIds)
      .eq('team_id', team.id)
      .eq('edition_id', edition.id)
      .eq('stage', stage)
      .eq('uploaded_by', userId)
      .is('consumed_at', null)
      .is('deleted_at', null);

    if (error) throw error;

    const rows = (data ?? []) as UploadRow[];
    if (rows.length !== uniqueIds.length) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'One or more uploaded files could not be used for this submission',
      );
    }

    return uniqueIds.map((id) => {
      const row = rows.find((item) => item.id === id);
      if (!row) throw AppError.validation('Uploaded file is unavailable');
      return toUploadFile(row);
    });
  }

  async markConsumed(fileIds: string[]) {
    if (fileIds.length === 0) return;

    const { error } = await this.supabase
      .from('submission_uploads')
      .update({ consumed_at: new Date().toISOString() } as never)
      .in('id', Array.from(new Set(fileIds)))
      .is('deleted_at', null);

    if (error) throw error;
  }

  private async assertLeaderCanUpload(userId: string, stage: 2 | 3) {
    const user = await platformReadService.getUserById(userId);
    if (user.verification_status !== 'verified') {
      throw new AppError(ERROR_CODES.VERIFICATION_PENDING, 'Only verified students can upload submission files');
    }
    if (!user.team_id) throw AppError.validation('You must belong to a team');

    const [team, edition] = await Promise.all([
      platformReadService.getTeamById(user.team_id),
      platformReadService.getActiveEdition(),
    ]);

    if (team.leader_id !== user.id) {
      throw new AppError(ERROR_CODES.ONLY_LEADER, 'Only team leader can upload submission files');
    }
    if (team.status !== 'active') throw AppError.forbidden('Team is not active');
    if (!edition.submission_window_open) {
      throw new AppError(ERROR_CODES.SUBMISSION_WINDOW_CLOSED, 'Submission window is closed');
    }
    if (edition.active_stage !== stage) {
      throw new AppError(ERROR_CODES.STAGE_CLOSED, `Only Stage ${edition.active_stage} uploads are currently open`);
    }

    return { user, team, edition };
  }
}

export const submissionUploadService = new SubmissionUploadService();
