import express from "express";
//controllers

import { isAuthenticated } from "../middlewares/auth.js";
import {
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  getMyGroups,
  leaveGroup,
  newGroupChat,
  removeMembers,
  renameGroupChat,
  sendAttachments,
} from "../controllers/chat.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import {
  addMemberValidator,
  chatIdValidator,
  leaveGroupValidator,
  newGroupValidator,
  removeMembersValidator,
  renameGroupValidator,
  sendAttachmentsValidator,
  validate,
} from "../lib/validators.js";
const router = express.Router();

router.use(isAuthenticated);

router.post("/new", newGroupValidator(), validate, newGroupChat);
router.get("/my", getMyChats);
router.get("/my/groups", getMyGroups);

router.put("/addmembers", addMemberValidator(), validate, addMembers);
router.put("/removemembers", removeMembersValidator(), validate, removeMembers);

router.delete("/leave/:chatId", leaveGroupValidator(), validate, leaveGroup);

//send attachments
router.post(
  "/message",
  attachmentsMulter,
  sendAttachmentsValidator(),
  validate,
  sendAttachments
);

//get messages
router.get("/message/:id", chatIdValidator(), validate, getMessages);

//get chat details, rename, delete
router
  .route("/:id")
  .get(chatIdValidator(), validate, getChatDetails)
  .put(renameGroupValidator(), validate, renameGroupChat)
  .delete(chatIdValidator(), validate, deleteChat);

export default router;
