import { TryCatch } from "../middlewares/error.js";
import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import { CHAT_ADMIN_TOKEN } from "../constants/config.js";

export const adminLogin = TryCatch(async (req, res, next) => {
  const { secretKey } = req.body;

  const adminSecretKey = process.env.ADMIN_SECRET_KEY || "Suman is the best";

  const isMatch = secretKey === adminSecretKey;

  if (!isMatch) return next(new ErrorHandler("Invalid Secret Key", 401));

  const token = jwt.sign(secretKey, process.env.JWT_SECRET);

  return res
    .status(200)
    .cookie(CHAT_ADMIN_TOKEN, token, {
      ...cookieOptions,
      maxAge: 1000 * 60 * 15,
    })
    .json({
      success: true,
      message: "Authenticated Successfully. Welcome BOSS",
    });
});

export const adminLogout = TryCatch(async (req, res, next) => {
  return res.status(200).clearCookie("chat-admin-token").json({
    success: true,
    message: "Logged Out Successfully",
  });
});

export const getAdminData = TryCatch(async (req, res, next) => {
  return res.status(200).json({
    admin: true,
  });
});

export const allUsers = TryCatch(async (req, res) => {
  const users = await User.find({});

  const transformedUsers = users.map(
    async ({ name, username, avatar, _id }) => {
      const [groups, friends] = await Promise.all([
        Chat.countDocuments({ groupChat: true, members: _id }),
        Chat.countDocuments({ groupChat: false, members: _id }),
      ]);
      return {
        name,
        username,
        avatar: avatar.url,
        _id,
        groups,
        friends,
      };
    }
  );
  const resolvedUsers = await Promise.all(transformedUsers);

  return res.status(200).json({
    success: true,
    data: resolvedUsers,
  });
});

export const allChats = TryCatch(async (req, res) => {
  const chats = await Chat.find({})
    .populate("members", "name avatar")
    .populate("creator", "name avatar");

  const transformedChats = await Promise.all(
    chats.map(async ({ members, _id, groupChat, name, creator }) => {
      const totalMessages = await Message.countDocuments({ chat: _id });
      return {
        _id,
        groupChat,
        name,
        avatar: members.slice(0, 3).map((member) => member.avatar.url),
        members: members.map(({ _id, name, avatar }) => ({
          _id,
          name,
          avatar: avatar.url,
        })),
        creator: {
          name: creator?.name || "None",
          avatar: creator?.avatar.url || "",
        },
        totalMembers: members.length,
        totalMessages,
      };
    })
  );

  return res.status(200).json({
    success: true,
    chats: transformedChats,
  });
});

export const allMessages = TryCatch(async (req, res) => {
  const messages = await Message.find({})
    .populate("sender", "name avatar")
    .populate("chat", "groupChat");

  const transformedMessages = messages.map(
    ({ sender, chat, content, attachements, _id, createdAt }) => ({
      _id,
      attachements,
      content,
      sender: {
        _id: sender._id,
        name: sender.name,
        avatar: sender.avatar.url,
      },
      groupChat: chat.groupChat,
      chat: chat._id,
      createdAt,
    })
  );

  return res.status(200).json({
    success: true,
    messages: transformedMessages,
  });
});

export const getDashboardStats = TryCatch(async (req, res) => {
  const [user, singleChat, groupChat, message] = await Promise.all([
    User.countDocuments(),
    Chat.countDocuments({ groupChat: false }),
    Chat.countDocuments({ groupChat: true }),
    Message.countDocuments(),
  ]);

  const today = new Date();

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const last7DaysMessage = await Message.find({
    createdAt: {
      $gte: last7Days,
      $lte: today,
    },
  }).select("createdAt");

  const messages = new Array(7).fill(0);
  const dayInMilliseconds = 24 * 60 * 60 * 1000;

  last7DaysMessage.forEach(({ createdAt }) => {
    const index = Math.floor(
      (today.getTime() - createdAt.getTime()) / dayInMilliseconds
    );

    messages[6 - index]++;
  });
  console.log(messages);

  const stats = {
    user,
    singleChat,
    groupChat,
    message,
    messagesChart: messages,
  };

  return res.status(200).json({
    success: true,
    stats,
  });
});
