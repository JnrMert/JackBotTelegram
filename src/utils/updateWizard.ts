import { composeWizardScene } from "./sceneFactory";
import { AnyContext, ContextComplement } from "../types/context";
import { findAllMessage, findMessage } from "../db/messageController";
import { Markup } from "telegraf";
import { findAllChat } from "../db/chatController";
import { updateAndSend } from "./sender";

const exit_keyboard = Markup.keyboard(["🛑 Çıkış"]).oneTime().resize();
const main_keyboard = Markup.keyboard(["➞ İleri", "🛑 Çıkış"])
  .oneTime()
  .resize();
const last_keyboard = Markup.keyboard([["✅ Evet", "❌ Hayır"], ["🛑 Çıkış"]])
  .oneTime()
  .resize();

const getMessagesKeyboard = async () => {
  let messages = [];
  for (const msg of await findAllMessage()) {
    messages.push([
      `${msg.id}: ${
        (msg.caption?.substring(0, 20) || "Metin Yok") + "..."
      } | Eklendi: ${msg.createdAt.getDate().toString().padStart(2, "0")}/${(
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

export const createUpdateWizard = composeWizardScene(
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.chat.type.match(/group|supergroup/)) {
      let adms = await ctx.getChatAdministrators();
      if (!adms.find((adm) => ctx.from?.id === adm.user.id)) {
        ctx.reply("Sadece yöneticiler mesajları botta güncelleyebilir");
        return done();
      }
    } else {
      if (ctx.from?.username?.match(/m_swag1|PozitifKK|best_analiz|m_y0991/)) {
        const msg_keyboard = await getMessagesKeyboard();
        ctx.reply(
          "Güncellemek istediğiniz mesajı seçin ya da id'yi girin:",
          msg_keyboard
        );
      } else {
        ctx.reply(
          "Sadece @m_swag1 ve @PozitifKK|best_analiz|cripto mesajları güncelleyebilir"
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
        "Mesaj beklenen formata uymuyor. Tekrar deneyin:",
        msg_keyboard
      );
      return ctx.wizard;
    }
    const msg = await findMessage(message_id);
    if (!msg) {
      console.log("Hata: Mesaj bulunamadı!");
      return done();
    }
    ctx.reply(
      'Mesajı düzenlemek istiyorsanız "Mesajı Değiştir" butonuna tıklayın ve istediğiniz mesajı gönderin. Aksi takdirde ➞ İleri butonuna tıklayın.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Mesajı Değiştir",
                switch_inline_query_current_chat: msg.caption || "",
              },
            ],
            [
              { text: "➞ İleri", switch_inline_query_current_chat: "➞ İleri" },
              {
                text: "🛑 Çıkış",
                switch_inline_query_current_chat: "🛑 Çıkış",
              },
            ],
          ],
        },
      }
    );

    ctx.wizard.state.groups = msg.groups;
    ctx.wizard.state.time = msg.period;
    ctx.wizard.state.type = msg.type;
    ctx.wizard.state.caption = msg.caption || undefined;
    ctx.wizard.state.file_id = msg.fileid || undefined;
    ctx.wizard.state.msg_id = message_id;

    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text?.match(/🛑 Çıkış/)) {
      return done();
    } else if (!ctx.message.text?.match(/➞ İleri/)) {
      ctx.wizard.state.caption = ctx.message.text;
    }
    const fill_reply =
      "Mevcut içeriği değiştirmek istiyorsanız (ses, resim, vb.) cevap olarak gönderin." +
      (ctx.wizard.state.file_id ? " Mevcut içerik mesajda mevcut." : "");
    switch (ctx.wizard.state.type) {
      case "text":
        await ctx.reply(`${fill_reply}`, main_keyboard);
        break;
      case "photo":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithPhoto(ctx.wizard.state.file_id, {
              caption: fill_reply,
              reply_markup: {
                keyboard: [["➞ İleri", "🛑 Çıkış"]],
                resize_keyboard: true,
              },
            })
            .catch((err) => ctx.reply("Fotoğraf getirilemedi"));
        else await ctx.reply("Fotoğraf getirilemedi");
        break;
      case "audio":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithAudio(ctx.wizard.state.file_id, {
              caption: fill_reply,
              reply_markup: {
                keyboard: [["➞ İleri", "🛑 Çıkış"]],
                resize_keyboard: true,
              },
            })
            .catch((err) => ctx.reply("Ses dosyası getirilemedi"));
        else await ctx.reply("Ses dosyası getirilemedi");
        break;
      case "sticker":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithSticker(ctx.wizard.state.file_id)
            .catch((err) => ctx.reply("Sticker getirilemedi"));
        else await ctx.reply("Sticker getirilemedi");
        break;
      case "animation":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithAnimation(ctx.wizard.state.file_id, {
              caption: fill_reply,
              reply_markup: {
                keyboard: [["➞ İleri", "🛑 Çıkış"]],
                resize_keyboard: true,
              },
            })
            .catch((err) => ctx.reply("Animasyon getirilemedi"));
        else await ctx.reply("Animasyon getirilemedi");
      case "video":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithVideo(ctx.wizard.state.file_id, {
              caption: fill_reply,
              reply_markup: {
                keyboard: [["➞ İleri", "🛑 Çıkış"]],
                resize_keyboard: true,
              },
            })
            .catch((err) => ctx.reply("Video getirilemedi"));
        else await ctx.reply("Video getirilemedi");
    }

    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text?.match(/🛑 Çıkış/)) {
      return done();
    }

    if (ctx.message.photo) {
      ctx.wizard.state.file_id =
        ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.wizard.state.type = "photo";
    } else if (ctx.message.audio) {
      ctx.wizard.state.file_id = ctx.message.audio.file_id;
      ctx.wizard.state.type = "audio";
    } else if (ctx.message.sticker) {
      ctx.wizard.state.file_id = ctx.message.sticker.file_id;
      ctx.wizard.state.type = "sticker";
    } else if (ctx.message.animation) {
      ctx.wizard.state.file_id = ctx.message.animation.file_id;
      ctx.wizard.state.type = "animation";
    } else if (ctx.message.video) {
      ctx.wizard.state.file_id = ctx.message.video.file_id;
      ctx.wizard.state.type = "video";
    }

    ctx.reply(
      "Mesajın gönderim süresini değiştirmek istiyorsanız süreyi saat ve dakika olarak girin, aksi takdirde ➞ İleri butonuna tıklayın",
      main_keyboard
    );
    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text?.match(/🛑 Çıkış/)) {
      return done();
    } else if (!ctx.message.text?.match(/➞ İleri/)) {
      const match = ctx.message.text?.match(
        /^(\d+)$|^(\d+)\s*[hm]\s*(\d+(?:\s*[m]*))?$/
      );
      if (!match) {
        ctx.reply(
          "Mesaj beklenen süre formatına uymuyor (ör: 10, 10m, 1h 30m). Yeni bir süre girin:"
        );
        return ctx.wizard;
      }
      let hour = 0;
      let min = 0;
      let trimmed = ctx.message.text?.trim() || "";
      if (trimmed.indexOf("h") != -1) {
        hour = parseInt(trimmed.substring(0, trimmed.indexOf("h")));
        if (!trimmed.endsWith("h"))
          min = parseInt(trimmed.substring(trimmed.indexOf("h") + 1));
      } else if (trimmed.indexOf("m") != -1)
        min = parseInt(trimmed.substring(0, trimmed.indexOf("m")));
      else min = parseInt(trimmed);

      if (!hour && !min) {
        ctx.reply("Süre işlenirken hata oluştu. Yeni bir süre girin:");
        return ctx.wizard;
      }

      ctx.wizard.state.time = (hour * 60 + min) * 60000;
    }
    const chats = await findAllChat();
    const chatString = [["-1 - Hepsi"]];
    for (const chat of chats) {
      chatString.push([`${chat.id} - ${chat.title}`]);
    }
    chatString.push(["➞ İleri", "🛑 Çıkış"]);

    const chatKeyboard = Markup.keyboard(chatString).oneTime().resize();

    ctx.reply(
      "Grupları değiştirmek istiyor musunuz? Aksi halde ➞ İleri butonuna tıklayın",
      chatKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text == "🛑 Çıkış") return done();
    if (!ctx.message.text?.match(/➞ İleri/)) {
      if (ctx.message.text?.match(/\d - ./)) {
        const chat_id = parseInt(
          ctx.message.text.substring(0, ctx.message.text.indexOf("-")).trim()
        );
        if (chat_id >= 0) ctx.wizard.state.groups = [chat_id];
        else
          ctx.wizard.state.groups = await (
            await findAllChat()
          ).map((chat) => chat.id);
      } else if (ctx.message.text?.match(/^(\d+[\s,]*)+$/)) {
        ctx.wizard.state.groups = ctx.message.text
          .split(",")
          .map((elem) => parseInt(elem));
      } else {
        const chats = await findAllChat();
        const chatString = [["-1 - Hepsi"]];
        for (const chat of chats) {
          chatString.push([`${chat.id} - ${chat.title}`]);
        }
        chatString.push(["➞ İleri", "🛑 Çıkış"]);

        const chatKeyboard = Markup.keyboard(chatString).oneTime().resize();
        ctx.reply(
          "Geçersiz grup! Seçeneklerden birini seçin ya da grupların id'lerini virgülle ayırarak gönderin.",
          chatKeyboard
        );
        return ctx.wizard;
      }
    }
    console.log(ctx.wizard.state);

    await ctx.reply(`Güncellenen mesaj:`);
    switch (ctx.wizard.state.type) {
      case "text":
        await ctx.reply(`${ctx.wizard.state.caption}`);
        break;
      case "photo":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithPhoto(ctx.wizard.state.file_id, {
              caption: ctx.wizard.state.caption,
            })
            .catch((err) => ctx.reply("Fotoğraf getirilemedi"));
        else await ctx.reply("Fotoğraf getirilemedi");
        break;
      case "audio":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithAudio(ctx.wizard.state.file_id, {
              caption: ctx.wizard.state.caption,
            })
            .catch((err) => ctx.reply("Ses dosyası getirilemedi"));
        else await ctx.reply("Ses dosyası getirilemedi");
        break;
      case "sticker":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithSticker(ctx.wizard.state.file_id)
            .catch((err) => ctx.reply("Sticker getirilemedi"));
        else await ctx.reply("Sticker getirilemedi");
        break;
      case "animation":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithAnimation(ctx.wizard.state.file_id, {
              caption: ctx.wizard.state.caption,
            })
            .catch((err) => ctx.reply("Animasyon getirilemedi"));
        else await ctx.reply("Animasyon getirilemedi");
      case "video":
        if (ctx.wizard.state.file_id)
          await ctx
            .replyWithVideo(ctx.wizard.state.file_id, {
              caption: ctx.wizard.state.caption,
            })
            .catch((err) => ctx.reply("Video getirilemedi"));
        else await ctx.reply("Video getirilemedi");
    }
    ctx.reply("Devam etmek istiyor musunuz?", last_keyboard);

    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text?.match(/"(❌ Hayır|✅ Evet|🛑 Çıkış)"/)) {
      ctx.reply("Beklenmedik Yanıt.");
      return ctx.wizard.back();
    }
    if (ctx.message.text?.match(/✅ Evet|evet|e/gi)) {
      const result = await updateAndSend(ctx.wizard.state.msg_id || -1, {
        time: ctx.wizard.state.time,
        type: ctx.wizard.state.type,
        caption: ctx.wizard.state.caption,
        file_id: ctx.wizard.state.file_id,
        groups: ctx.wizard.state.groups,
      });
      if (result)
        ctx.reply("Mesaj başarıyla güncellendi", {
          reply_markup: { remove_keyboard: true },
        });
    }

    if (ctx.message.text?.match(/❌ Hayır|hayır|h/gi)) {
      const msg_keyboard = await getMessagesKeyboard();
      ctx.reply(
        "Güncellemek istediğiniz mesajı seçin ya da id'yi girin:",
        msg_keyboard
      );
      return ctx.wizard.selectStep(1);
    }

    return done();
  }
);
