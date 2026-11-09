import { AppError } from '@/lib/app-error';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, getSessionContext } from '@/lib/serverAuth';
import { errorResponse, personalKeyFrom } from '@/lib/http';
import { resolveApiKey } from '@/lib/import/gemini';
import { assertOwnBlobUrl, deleteBlob, fetchBlobBuffer, isBlobConfigured } from '@/lib/import/blob';
import { quotaStatus, quotaWindowStart } from '@/lib/import/quota';
import { ACTIVE_STATUSES, createImport, serializeJob } from '@/lib/import/service';
import { MAX_FILE_BYTES, detectFormat } from '@/lib/import/text';

// Extraction + analyse IA dans la même requête : peut prendre plusieurs minutes.
export const maxDuration = 300;

async function quotaFor(userId: string, isAdmin: boolean, personalKey: boolean) {
  const used = await prisma.importJob.count({
    where: { ownerId: userId, createdAt: { gte: quotaWindowStart() }, status: { not: 'ERROR' } },
  });
  return quotaStatus({ used, isAdmin, personalKey });
}

/** Imports en cours de l'utilisateur et son quota restant. */
export async function GET(request: Request) {
  try {
    const { userId, isAdmin } = await getSessionContext();
    const [jobs, quota] = await Promise.all([
      prisma.importJob.findMany({
        where: { ownerId: userId, status: { in: [...ACTIVE_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      quotaFor(userId, isAdmin, Boolean(personalKeyFrom(request))),
    ]);
    return NextResponse.json({
      jobs: jobs.map(serializeJob).filter((j) => j.status !== 'ERROR'),
      quota,
      serverKey: Boolean(process.env.GEMINI_API_KEY),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Lance un import. Corps JSON { fileUrl, fileName } (fichier déjà sur Vercel
 * Blob) ou multipart avec `file` (développement local, sans Blob).
 */
export async function POST(request: Request) {
  let blobUrl: string | null = null;
  try {
    const { userId, isAdmin } = await getSessionContext();
    await ensureUserProfile(userId);

    const { apiKey, personal } = resolveApiKey(personalKeyFrom(request));
    if (!apiKey) throw new AppError('Aucune clé IA disponible : ajoutez votre clé Gemini dans les réglages.', 503);

    const quota = await quotaFor(userId, isAdmin, personal);
    if (!quota.allowed) {
      throw new AppError(
        `Limite atteinte : ${quota.limit} imports par 24 h. Réessayez plus tard, ou ajoutez votre propre clé Gemini dans les réglages.`,
        429,
      );
    }

    let fileName: string;
    let buffer: Buffer;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      if (isBlobConfigured()) throw new AppError("Envoyez le fichier via le stockage de l'application.");
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) throw new AppError('Aucun fichier reçu.');
      if (file.size > MAX_FILE_BYTES) throw new AppError('Fichier trop volumineux (40 Mo maximum).', 413);
      fileName = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = (await request.json().catch(() => ({}))) as { fileUrl?: unknown; fileName?: unknown };
      if (typeof body.fileUrl !== 'string' || typeof body.fileName !== 'string') {
        throw new AppError('Fichier manquant.');
      }
      try {
        assertOwnBlobUrl(body.fileUrl, userId);
      } catch (err) {
        throw new AppError((err as Error).message, 403);
      }
      blobUrl = body.fileUrl;
      fileName = body.fileName;
      try {
        buffer = await fetchBlobBuffer(body.fileUrl);
      } catch (err) {
        throw new AppError((err as Error).message, 404);
      }
      if (buffer.length > MAX_FILE_BYTES) throw new AppError('Fichier trop volumineux (40 Mo maximum).', 413);
    }

    if (!detectFormat(fileName, buffer)) {
      throw new AppError('Format non pris en charge : importez un fichier PDF, TXT ou Markdown.');
    }

    const job = await createImport({ ownerId: userId, fileName, fileSize: buffer.length, buffer, apiKey });
    return NextResponse.json({ job: serializeJob(job) }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "Impossible de lancer l'import.");
  } finally {
    // Le fichier n'est plus utile une fois son texte extrait (ou en cas d'échec).
    if (blobUrl) await deleteBlob(blobUrl);
  }
}
