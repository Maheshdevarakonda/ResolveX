import { v2 as cloudinary } from "cloudinary";
import { Types } from "mongoose";
import { AuthUser } from "../../middleware/authenticate";
import { Complaint, IAttachment } from "../../models/Complaint";
import { env, uploadsConfigured } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { tenantFilter } from "../../utils/tenant";
import { recordAudit } from "../audit/audit.service";
import { findScoped, getComplaintDto } from "./complaint.service";

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ATTACHMENTS = 5;

function upload(file: Express.Multer.File, folder: string): Promise<{ secure_url: string; public_id: string }> {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Upload failed"));
      resolve(result);
    });
    stream.end(file.buffer);
  });
}

export async function addAttachments(actor: AuthUser, complaintId: string, files: Express.Multer.File[]) {
  if (!uploadsConfigured) throw new ApiError(503, "File uploads are not configured on this server");
  if (files.length === 0) throw ApiError.badRequest("No files were uploaded");

  const complaint = await findScoped(actor, complaintId);
  if (actor.role === "EMPLOYEE" && String(complaint.assignedTo) !== actor.id) {
    throw ApiError.conflict("Accept this complaint before adding files");
  }
  if (complaint.status === "CLOSED") throw ApiError.conflict("This complaint is closed");
  if (complaint.attachments.length + files.length > MAX_ATTACHMENTS) {
    throw ApiError.badRequest(`A complaint can have at most ${MAX_ATTACHMENTS} attachments`);
  }

  const folder = `resolvex/${actor.organizationId}/${complaint._id}`;
  const uploaded: IAttachment[] = [];
  for (const file of files) {
    const result = await upload(file, folder);
    uploaded.push({
      url: result.secure_url,
      publicId: result.public_id,
      name: file.originalname.slice(0, 200),
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  await Complaint.updateOne(
    { _id: complaint._id, ...tenantFilter(actor.organizationId) },
    { $push: { attachments: { $each: uploaded } } }
  );
  await recordAudit({
    organizationId: actor.organizationId,
    actor,
    action: "ATTACHMENT_ADDED",
    entityType: "COMPLAINT",
    entityId: complaint._id,
    complaintId: new Types.ObjectId(String(complaint._id)),
    changes: { after: { files: uploaded.map((u) => u.name) } },
  });
  return getComplaintDto(actor, complaintId);
}
