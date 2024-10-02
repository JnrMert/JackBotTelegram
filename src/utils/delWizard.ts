import { Markup } from "telegraf";
import { composeWizardScene } from "./sceneFactory";
import { AnyContext, ContextComplement } from "../types/context";
import {
  findAllMessage,
  deleteMessage,
  findMessage,
} from "../db/messageController";

const exit_keyboard = Markup.keyboard(["🛑 Çıkış"]).oneTime().resize();

const getMessagesKeyboard = async () => {
  let messages = [];
  for (const msg of await findAllMessage()) {
    messages.push([
      `${msg.id}: ${
        (msg.caption?.substring(0, 20) || "Metin Yok") + "..."
      } | Ekleme: ${msg.createdAt.getDate().toString().padStart(2, "0")}/${(
        msg.createdAt.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")} | ${msg.type}`,
    ]);
  }
  messages.push(["🛑 Çıkış"]);
  const msg_keyboard = Markup.keyboard(messages).oneTime().resize();

  return msg_keyboard;
};

export const createDelWizard = composeWizardScene(
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.chat.type.match(/group|supergroup/)) {
      let adms = await ctx.getChatAdministrators();
      if (!adms.find((adm) => ctx.from?.id === adm.user.id)) {
        ctx.reply("Yalnızca yöneticiler bota mesaj ekleyebilir");
        return done();
      }
    } else {
      if (ctx.from?.username?.match(/m_swag1|PozitifKK|best_analiz|m_y0991/)) {
        const msg_keyboard = await getMessagesKeyboard();
        ctx.reply("Silmek için bir mesaj seçin veya id girin:", msg_keyboard);
      } else {
        ctx.reply(
          "Yalnızca @m_swag1 ve @PozitifKK|best_analiz|cripto mesajları silebilir"
        );
        return done();
      }
    }
    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text?.match(/🛑 Çıkış/)) {
      return done();
    }
    let message_id: number = -1;
    if (ctx.message.text?.match(/^\d+:/))
      message_id = parseInt(
        ctx.message.text.substring(0, ctx.message.text.indexOf(":"))
      );
    else if (ctx.message.text?.match(/^\d+$/))
      message_id = parseInt(ctx.message.text);
    else {
      const msg_keyboard = await getMessagesKeyboard();
      ctx.reply(
        "Mesaj beklenen formatla uyuşmuyor. Tekrar deneyin:",
        msg_keyboard
      );
      return ctx.wizard;
    }
    if (message_id != -1 || !message_id) {
      const message = await findMessage(message_id);
      if (!message) {
        ctx.reply(
          "Mesaj bulunamadı, tekrar deneyin.",
          await getMessagesKeyboard()
        );
        return ctx.wizard;
      }
      await ctx.reply(`Silinecek mesaj:`);
      switch (message?.type) {
        case "text":
          await ctx.reply(`${message.caption}`);
          break;
        case "photo":
          if (message.fileid)
            await ctx
              .replyWithPhoto(message.fileid, {
                caption: message.caption || "",
              })
              .catch((err) => ctx.reply("Fotoğraf getirilemedi"));
          else await ctx.reply("Fotoğraf getirilemedi");
          break;
        case "audio":
          if (message.fileid)
            await ctx
              .replyWithAudio(message.fileid, {
                caption: message.caption || "",
              })
              .catch((err) => ctx.reply("Ses dosyası getirilemedi"));
          else await ctx.reply("Ses dosyası getirilemedi");
          break;
        case "sticker":
          if (message.fileid)
            await ctx
              .replyWithSticker(message.fileid)
              .catch((err) => ctx.reply("Sticker getirilemedi"));
          else await ctx.reply("Sticker getirilemedi");
          break;
        case "animation":
          if (message.fileid)
            await ctx
              .replyWithAnimation(message.fileid, {
                caption: message.caption || "",
              })
              .catch((err) => ctx.reply("Animasyon getirilemedi"));
          else await ctx.reply("Animasyon getirilemedi");
        case "video":
          if (message.fileid)
            await ctx
              .replyWithVideo(message.fileid, {
                caption: message.caption || "",
              })
              .catch((err) => ctx.reply("Video getirilemedi"));
          else await ctx.reply("Video getirilemedi");
      }
      const last_keyboard = Markup.keyboard([
        ["✅ Evet", "❌ Hayır"],
        ["🛑 Çıkış"],
      ])
        .oneTime()
        .resize();
      ctx.reply("Devam etmek istiyor musunuz?", last_keyboard);
    } else
      ctx.reply(
        `Mesaj ID'si çözümlemede başarısız oldu. Aldığım: ${message_id}`
      );
    ctx.wizard.state.msg_id = message_id;
    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text?.match(/"(❌ Hayır|✅ Evet|🛑 Çıkış)"/)) {
      ctx.reply("Beklenmeyen bir cevap alındı.");
      return ctx.wizard.back();
    }
    if (ctx.message.text?.match(/❌ Hayır|hayır/gi)) {
      ctx.reply(
        "Silmek için bir mesaj seçin veya id girin:",
        await getMessagesKeyboard()
      );
      return ctx.wizard.selectStep(0);
    }

    const message_id = ctx.wizard.state.msg_id;
    if (!message_id) {
      await ctx.reply("Mesaj bulunamadı.");
      return ctx.wizard.selectStep(0);
    }
    if (ctx.message.text?.match(/✅ Evet|evet/gi)) {
      const result = await deleteMessage(message_id);
      if (result) ctx.reply("Mesaj başarıyla silindi");
      else ctx.reply(`ID'si ${message_id} olan mesaj bulunamadı.`);
    }
    return done();
  }
);
