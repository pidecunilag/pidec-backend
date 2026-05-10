import multer, { MulterError } from 'multer';
import { type RequestHandler } from 'express';
import {
  ERROR_CODES,
  FILE_LIMITS,
  SUBMISSION_FILE_MIME_TYPES,
  VERIFICATION_DOC_MIME_TYPES,
} from '@pidec/shared';
import { AppError } from '../../shared/errors/app-error.js';

const detectMimeFromBuffer = (buffer: Buffer): (typeof VERIFICATION_DOC_MIME_TYPES)[number] | null => {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) {
    return 'application/pdf';
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }

  return null;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_LIMITS.VERIFICATION_DOC_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!VERIFICATION_DOC_MIME_TYPES.includes(file.mimetype as (typeof VERIFICATION_DOC_MIME_TYPES)[number])) {
      cb(new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Only PDF, PNG, and JPG documents are allowed'));
      return;
    }
    cb(null, true);
  },
});

const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_LIMITS.SUBMISSION_FILE_MAX_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!SUBMISSION_FILE_MIME_TYPES.includes(file.mimetype as (typeof SUBMISSION_FILE_MIME_TYPES)[number])) {
      cb(new AppError(ERROR_CODES.INVALID_FILE_TYPE, 'Only PDF, DOCX, PPTX, ZIP, PNG, JPG, and WEBP files are allowed'));
      return;
    }
    cb(null, true);
  },
});

const detectSubmissionMimeFromBuffer = (
  buffer: Buffer,
  declaredMime: string,
): (typeof SUBMISSION_FILE_MIME_TYPES)[number] | null => {
  const detectedVerificationMime = detectMimeFromBuffer(buffer);
  if (detectedVerificationMime) return detectedVerificationMime;

  const isZipContainer = buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (
    isZipContainer &&
    [
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(declaredMime)
  ) {
    return declaredMime as (typeof SUBMISSION_FILE_MIME_TYPES)[number];
  }

  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    buffer.subarray(8, 12).equals(Buffer.from('WEBP'));
  if (isWebp) return 'image/webp';

  const isLegacyWord =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (isLegacyWord && declaredMime === 'application/msword') return declaredMime;

  return null;
};

export const parseVerificationDocumentUpload: RequestHandler = (req, res, next) => {
  upload.single('document')(req, res, (err?: unknown) => {
    if (!err) {
      const file = (req as { file?: Express.Multer.File }).file;
      if (file?.buffer) {
        const detectedMime = detectMimeFromBuffer(file.buffer);
        if (!detectedMime || detectedMime !== file.mimetype) {
          next(
            new AppError(
              ERROR_CODES.INVALID_FILE_TYPE,
              'Verification document content does not match the declared file type',
            ),
          );
          return;
        }
      }

      next();
      return;
    }

    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(ERROR_CODES.FILE_TOO_LARGE, 'Verification document must be 5MB or smaller'));
      return;
    }

    if (err instanceof AppError) {
      next(err);
      return;
    }

    next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid verification document upload'));
  });
};

export const parseSubmissionFileUpload: RequestHandler = (req, res, next) => {
  submissionUpload.single('file')(req, res, (err?: unknown) => {
    if (!err) {
      const file = (req as { file?: Express.Multer.File }).file;
      if (!file?.buffer) {
        next(AppError.validation('Submission file is required'));
        return;
      }

      const detectedMime = detectSubmissionMimeFromBuffer(file.buffer, file.mimetype);
      if (!detectedMime || detectedMime !== file.mimetype) {
        next(
          new AppError(
            ERROR_CODES.INVALID_FILE_TYPE,
            'Submission file content does not match the declared file type',
          ),
        );
        return;
      }

      next();
      return;
    }

    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(ERROR_CODES.FILE_TOO_LARGE, 'Submission file must be 50MB or smaller'));
      return;
    }

    if (err instanceof AppError) {
      next(err);
      return;
    }

    next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid submission file upload'));
  });
};
