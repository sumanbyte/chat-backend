// package imports
import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import { v4 as uuid } from "uuid";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import { corsOptions } from "./constants/config.js";

//database connection
import { connectDB } from "./utils/features.js";

//dotenv configuration
import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

//importing routes
import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
import adminRoute from "./routes/admin.js";

//importing middlewares
import { errorMiddleware } from "./middlewares/error.js";
import {
  ALERT,
  CHAT_JOINED,
  CHAT_LEFT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  ONLINE_USERS,
  START_TYPING,
  STOP_TYPING,
} from "./shared/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import { socketAuthenticator } from "./middlewares/auth.js";

// server configuration
const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;
const app = express();
connectDB(mongoURI);

//cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//socket.io server configuration
const server = createServer(app);
const io = new Server(server, { cors: corsOptions });

app.set("io", io);
//middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

// routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);
app.get("/", (req, res) => res.send("hello"));

//socket.io middleware

io.use((socket, next) => {
  cookieParser()(socket.request, socket.request.res, async (err) => {
    await socketAuthenticator(err, socket, next);
  });
});

// socket.io configuration
export const userSocketIDs = new Map();
export const onlineUsers = new Set();
io.on("connection", (socket) => {
  const user = socket.user;
  userSocketIDs.set(user._id.toString(), socket.id);
  // console.log(userSocketIDs);

  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForRealTime = {
      _id: uuid(),
      content: message,
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };

    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };

    const membersSocket = getSockets(members);

    // console.log("Emitting ", membersSocket);

    io.to(membersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });

    io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {
      console.log(error);
    }
    console.log("new message received", messageForRealTime);
  });

  socket.on(START_TYPING, ({ members, chatId }) => {
    console.log("start typing", members, chatId);
    const membersSocket = getSockets(members);
    socket.to(membersSocket).emit(START_TYPING, { chatId });
  });
  socket.on(STOP_TYPING, ({ members, chatId }) => {
    console.log("stop typing", members, chatId);
    const membersSocket = getSockets(members);
    socket.to(membersSocket).emit(STOP_TYPING, { chatId });
  });

  socket.on(CHAT_JOINED, ({ userId, members }) => {
    onlineUsers.add(userId);
    const membersSocket = getSockets(members);
    console.log(onlineUsers);
    io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on(CHAT_LEFT, ({ userId, members }) => {
    console.log("Chat Left: ", userId, members);

    onlineUsers.delete(userId);
    const membersSocket = getSockets(members);
    console.log(onlineUsers);
    io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    userSocketIDs.delete(user._id.toString());
    onlineUsers.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
  });
});

// error middleware must be last
app.use(errorMiddleware);

// start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV}`);
});

//constants
export const adminSecretKey = process.env.ADMIN_SECRET_KEY;
export const envMode = process.env.NODE_ENV.trim() || "production";
