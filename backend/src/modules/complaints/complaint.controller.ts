import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { addComment, listComments } from "../comments/comment.service";
import { getFeedbackFor, submitFeedback } from "../feedback/feedback.service";
import { addAttachments } from "./attachment.service";
import * as service from "./complaint.service";
import { ListComplaintsQuery } from "./complaint.schema";

export const create = asyncHandler(async (req, res) => {
  const complaint = await service.createComplaint(req.user!, req.body);
  sendSuccess(res, { complaint }, "Complaint submitted", 201);
});

export const list = asyncHandler(async (req, res) => {
  // validate() already parsed the query and applied defaults.
  const { items, meta } = await service.listComplaints(req.user!, req.query as unknown as ListComplaintsQuery);
  sendSuccess(res, items, "OK", 200, { ...meta });
});

export const stats = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.complaintStats(req.user!));
});

export const get = asyncHandler(async (req, res) => {
  sendSuccess(res, { complaint: await service.getComplaintDto(req.user!, req.params.id) });
});

export const assign = asyncHandler(async (req, res) => {
  const complaint = await service.assignComplaint(req.user!, req.params.id, req.body);
  sendSuccess(res, { complaint }, "Complaint assigned");
});

export const accept = asyncHandler(async (req, res) => {
  const complaint = await service.acceptComplaint(req.user!, req.params.id);
  sendSuccess(res, { complaint }, "Complaint accepted");
});

export const changeStatus = asyncHandler(async (req, res) => {
  const complaint = await service.changeStatus(req.user!, req.params.id, req.body);
  sendSuccess(res, { complaint }, "Status updated");
});

export const updatePriority = asyncHandler(async (req, res) => {
  const complaint = await service.updatePriority(req.user!, req.params.id, req.body);
  sendSuccess(res, { complaint }, "Priority updated");
});

export const close = asyncHandler(async (req, res) => {
  const complaint = await service.closeComplaint(req.user!, req.params.id);
  sendSuccess(res, { complaint }, "Complaint closed");
});

export const reopen = asyncHandler(async (req, res) => {
  const complaint = await service.reopenComplaint(req.user!, req.params.id, req.body.reason);
  sendSuccess(res, { complaint }, "Complaint reopened");
});

export const comments = asyncHandler(async (req, res) => {
  sendSuccess(res, await listComments(req.user!, req.params.id));
});

export const createComment = asyncHandler(async (req, res) => {
  const comment = await addComment(req.user!, req.params.id, req.body);
  sendSuccess(res, { comment }, "Comment added", 201);
});

export const attachments = asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const complaint = await addAttachments(req.user!, req.params.id, files);
  sendSuccess(res, { complaint }, "Files uploaded", 201);
});

export const feedback = asyncHandler(async (req, res) => {
  sendSuccess(res, { feedback: await getFeedbackFor(req.user!, req.params.id) });
});

export const createFeedback = asyncHandler(async (req, res) => {
  const feedback = await submitFeedback(req.user!, req.params.id, req.body);
  sendSuccess(res, { feedback }, "Thank you for your feedback", 201);
});

