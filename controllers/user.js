import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import {
  emitEvent,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import { TryCatch } from "../middlewares/error.js";
import { ErrorHandler } from "../utils/utility.js";
import { Request } from "../models/request.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../shared/events.js";
import { getOtherMember } from "../lib/helper.js";
//create  a new user, save it to database and save in cookie
export const login = TryCatch(async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).select("+password");

  if (!user) next(new ErrorHandler("Invalid username or Password", 404));

  if (!(await user.comparePassword(password))) {
    return next(new ErrorHandler("Invalid password", 400));
  }
  sendToken(res, user, 200, `Welcome back ${user.name}`);
});

export const newUser = async (req, res, next) => {
  const { name, username, password, bio } = req.body;

  const file = req.file;

  if (!file) {
    return next(new ErrorHandler("Please upload avatar", 400));
  }
  const result = await uploadFilesToCloudinary([file]);
  console.log(result);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };
  const user = await User.create({ name, username, password, avatar, bio });
  sendToken(res, user, 201, "User created Successfully");
};

export const getMyProfile = TryCatch(async (req, res) => {
  const user = await User.findById(req.user);
  res.status(200).json({
    success: true,
    user: user,
    message: "User profile fetched successfully",
  });
});

export const logout = TryCatch(async (req, res) => {
  return res.status(200).clearCookie("chat-token").json({
    success: true,
    message: "Logged out successfully",
  });
});

export const searchUser = TryCatch(async (req, res) => {
  const { name = "" } = req.query;

  const myChats = await Chat.find({
    groupChat: false,
    members: req.user,
  });

  // all users from my chat means friends or people i have chatted with
  const allUsersFromMyChats = myChats.map((chat) => chat.members).flat();

  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: allUsersFromMyChats },
    name: { $regex: name, $options: "i" },
  })
    .lean()
    .select("name avatar");

  console.log(allUsersExceptMeAndFriends);

  const users = allUsersExceptMeAndFriends.map((i) => ({
    ...i,
    avatar: i.avatar.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});

export const sendFriendRequest = TryCatch(async (req, res, next) => {
  const { userId } = req.body;
  const request = await Request.findOne({
    $or: [
      { sender: req.user, receiver: userId },
      { sender: userId, receiver: req.user },
    ],
  });

  if (request)
    return next(new ErrorHandler("Already sent friend request", 400));

  if (userId.toString() === req.user.toString())
    return next(
      new ErrorHandler("You can't send friend request to yourself", 400)
    );
  await Request.create({
    sender: req.user,
    receiver: userId,
  });

  emitEvent(req, NEW_REQUEST, [userId]);
  return res.status(200).json({
    success: true,
    message: "Friend request sent",
  });
});

export const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;

  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");
  if (!request) return next(new ErrorHandler("Request not found", 404));

  if (request.receiver._id.toString() !== req.user.toString())
    return next(new ErrorHandler("UnAuthorized", 400));

  if (!accept) {
    await request.deleteOne();
    return res.status(200).json({
      success: true,
      message: "Friend request declined",
    });
  }

  const members = [request.sender, request.receiver];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name}-${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  const chatMembers = members.map((member) => member._id.toString());
  console.log(chatMembers);
  emitEvent(req, REFETCH_CHATS, chatMembers);

  return res.status(200).json({
    success: true,
    message: "Friend request accepted",
    senderId: request.sender._id,
  });
});

export const getAllNotifications = TryCatch(async (req, res) => {
  const requests = await Request.find({ receiver: req.user }).populate(
    "sender",
    "name avatar"
  );

  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));

  return res.status(200).json({
    success: true,
    allRequests,
  });
});

export const getMyFriends = TryCatch(async (req, res) => {
  const chatId = req.query.chatId;

  const chats = await Chat.find({
    members: req.user,
    groupChat: false,
  }).populate("members", "name avatar");

  const friends = chats.map(({ members }) => {
    const otherUser = getOtherMember(members, req.user);
    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar.url,
    };
  });

  if (chatId) {
    const chat = await Chat.findById(chatId).populate("members", "name avatar");
    const chatMembersIds = chat.members.map((member) => member._id.toString());
    const availableFriends = friends.filter(
      (friend) => !chatMembersIds.includes(friend._id.toString())
    );

    return res.status(200).json({
      success: true,
      friends: availableFriends,
    });
  } else {
    return res.status(200).json({
      success: true,
      friends,
    });
  }
});
