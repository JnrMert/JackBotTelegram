import { bot } from "../bot/bot";
import { prisma } from "../db/prisma";
import { addMessage, updateMessage } from "../db/messageController";
import { Message } from "../types/message";
import { findManyChat, findAllChat } from "../db/chatController";

const sendMessage = async (message: Message, chatid: BigInt) => {
  switch (message.type) {
    case "text":
      await bot.telegram
        .sendMessage(chatid.toString(), message.caption || "boş", {
          reply_markup: { remove_keyboard: true },
        })
        .catch((err) => {
          console.log("Mesaj gönderilemedi.");
        });
      break;
    case "photo":
      if (message.file_id)
        await bot.telegram
          .sendPhoto(chatid.toString(), message.file_id, {
            caption: message.caption,
            reply_markup: { remove_keyboard: true },
          })
          .catch((err) => {
            console.log("Fotoğraf gönderilemedi.");
          });
      break;
    case "audio":
      if (message.file_id)
        await bot.telegram
          .sendAudio(chatid.toString(), message.file_id, {
            caption: message.caption,
            reply_markup: { remove_keyboard: true },
          })
          .catch((err) => {
            console.log("Ses dosyası gönderilemedi.");
          });
      break;
    case "sticker":
      if (message.file_id)
        await bot.telegram
          .sendSticker(chatid.toString(), message.file_id, {
            reply_markup: { remove_keyboard: true },
          })
          .catch((err) => {
            console.log("Sticker gönderilemedi.");
          });
      break;
    case "animation":
      if (message.file_id)
        await bot.telegram
          .sendAnimation(chatid.toString(), message.file_id, {
            caption: message.caption,
            reply_markup: { remove_keyboard: true },
          })
          .catch((err) => {
            console.log("Animasyon gönderilemedi.");
          });
      break;
    case "video":
      if (message.file_id)
        await bot.telegram
          .sendVideo(chatid.toString(), message.file_id, {
            caption: message.caption,
            reply_markup: { remove_keyboard: true },
          })
          .catch((err) => {
            console.log("Video gönderilemedi.");
          });
      break;
  }
};

const addAndSend = async (message: Message) => {
  const result = await addMessage(message);
  if (result) {
    const chats = await findManyChat(message.groups);
    if (!chats) {
      console.log("Kayıtlı sohbet bulunamadı.");
      return;
    }
    for (const chat of chats) {
      await sendMessage(message, chat.chatid);
    }
  }

  return true;
};

const updateAndSend = async (id: number, message: Message) => {
  if (id == -1) return false;
  const result = await updateMessage(id, message);
  if (result) {
    const chats = await findManyChat(message.groups);
    if (!chats) {
      console.log("Kayıtlı sohbet bulunamadı.");
      return;
    }
    for (const chat of chats) {
      await sendMessage(message, chat.chatid);
    }
  }
  return true;
};

const messageCheck = async () => {
  setInterval(async () => {
    const messages = await prisma.message.findMany();
    for (const message of messages) {
      let nextCall: Date = new Date(
        message.lastCalled.getTime() + message.period
      );
      if (nextCall < new Date(Date.now())) {
        const chats = await findManyChat(message.groups);
        console.log(
          `Mesaj gönderiliyor. ID: ${message.id}. Başlık: ${
            (message.caption?.substring(0, 20) || "başlık yok") + "..."
          }. Dosya ID: ${message.fileid || "dosya yok"}`
        );
        for (const chat of chats)
          await sendMessage(
            {
              time: message.period,
              type: message.type,
              caption: message.caption || undefined,
              file_id: message.fileid || undefined,
              groups: message.groups,
            },
            chat.chatid
          );
        await prisma.message.update({
          where: {
            id: message.id,
          },
          data: {
            lastCalled: new Date(),
          },
        });
      }
    }
  }, 60000);
};

export { addAndSend, updateAndSend, messageCheck };
