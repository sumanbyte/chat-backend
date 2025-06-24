import express from "express";
import { singleAvatar } from "../middlewares/multer.js";
//controllers
import {
  acceptFriendRequest,
  getAllNotifications,
  getMyFriends,
  getMyProfile,
  login,
  logout,
  newUser,
  searchUser,
  sendFriendRequest,
} from "../controllers/user.js";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  acceptFriendRequestValidator,
  loginValidator,
  registerValidator,
  sendFriendRequestValidator,
  validate,
} from "../lib/validators.js";
const router = express.Router();

router.post("/new", singleAvatar, registerValidator(), validate, newUser);
router.post("/login", loginValidator(), validate, login);

//after here user must be authenticated

router.use(isAuthenticated);
router.get("/me", getMyProfile);
router.get("/logout", logout);
router.get("/search", searchUser);
router.put(
  "/sendrequest",
  sendFriendRequestValidator(),
  validate,
  sendFriendRequest
);
router.put(
  "/acceptrequest",
  acceptFriendRequestValidator(),
  validate,
  acceptFriendRequest
);

router.get("/notifications", getAllNotifications);
router.get("/friends", getMyFriends);

export default router;
