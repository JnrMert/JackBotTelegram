import { Markup } from "telegraf";
import { composeWizardScene } from "./sceneFactory";
import { addAndSend } from "./sender";
import { AnyContext, ContextComplement } from "../types/context";
import { findAllChat } from "../db/chatController";

const exit_keyboard = Markup.keyboard(["🛑 Çıkış"]).oneTime().resize();
const last_keyboard = Markup.keyboard([["✅ Evet", "❌ Hayır"], ["🛑 Çıkış"]])
  .oneTime()
  .resize();
const empty_keyboard = Markup.keyboard([""]).oneTime().resize();

export const createAddWizard = composeWizardScene(
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.chat.type.match(/group|supergroup/)) {
      let adms = await ctx.getChatAdministrators();
      if (!adms.find((adm) => ctx.from?.id === adm.user.id)) {
        ctx.reply("Yalnızca yöneticiler bota mesaj ekleyebilir");
        return done();
      }
    }
    if (ctx.from?.username?.match(/m_swag1|PozitifKK|best_analiz|m_y0991/)) {
      ctx.reply("Kaydetmek istediğiniz mesajı gönderin.", exit_keyboard);
      return ctx.wizard.next();
    } else {
      ctx.reply(
        "Sadece @m_swag1 ve @PozitifKK|best_analiz|cripto mesaj ekleyebilir"
      );
      return done();
    }
  },
  (ctx: AnyContext & ContextComplement, done: any) => {
    // console.log(ctx.message);
    if (ctx.message.text == "🛑 Çıkış") return done();
    if (ctx.updateType == "message") {
      // 1. Mesajı kaydetme adımı (var olan kod)
      if (ctx.message.text) {
        ctx.wizard.state.caption = ctx.message.text;
        ctx.wizard.state.type = "text";
        const buttonRegex = /\[👉 ([^\]]+)\]\(buttonurl:\/\/([^)\s]+)\)/g;
        let match;
        const buttons = [];

        // 2. buttonurl formatını yakala ve butonlara dönüştür
        while ((match = buttonRegex.exec(ctx.wizard.state.caption)) !== null) {
          const [_, buttonText, buttonUrl] = match;
          buttons.push({ text: buttonText, url: buttonUrl });
        }

        // 3. Eğer butonlar varsa caption ile birlikte inline buton gönder
        if (buttons.length > 0) {
          ctx.reply("Otomatik Mesaj İçeriği:", {
            reply_markup: {
              inline_keyboard: buttons.map((button) => [
                { text: button.text, url: button.url },
              ]),
            },
          });
          // 4. Mesajın içinde buton linklerini temizleyin
          ctx.wizard.state.caption = ctx.wizard.state.caption.replace(
            buttonRegex,
            ""
          );
        } else {
          // Eğer buton yoksa normal şekilde mesajı göster
          ctx.reply(ctx.wizard.state.caption);
        }
      } else if (ctx.message.photo) {
        ctx.wizard.state.caption = ctx.message.caption;
        ctx.wizard.state.file_id =
          ctx.message.photo[ctx.message.photo.length - 1].file_id;
        ctx.wizard.state.type = "photo";
      } else if (ctx.message.audio) {
        ctx.wizard.state.caption = ctx.message.caption;
        ctx.wizard.state.file_id = ctx.message.audio.file_id;
        ctx.wizard.state.type = "audio";
      } else if (ctx.message.sticker) {
        ctx.wizard.state.file_id = ctx.message.sticker.file_id;
        ctx.wizard.state.type = "sticker";
      } else if (ctx.message.animation) {
        ctx.wizard.state.file_id = ctx.message.animation.file_id;
        ctx.wizard.state.caption = ctx.message.caption;
        ctx.wizard.state.type = "animation";
      } else if (ctx.message.video) {
        ctx.wizard.state.file_id = ctx.message.video.file_id;
        ctx.wizard.state.caption = ctx.message.caption;
        ctx.wizard.state.type = "video";
      }
    }
    ctx.reply("Mesajın ne sıklıkla gönderileceğini girin?", exit_keyboard);
    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text == "🛑 Çıkış") return done();
    const match = ctx.message.text?.match(
      /^(\d+)$|^(\d+)\s*[hm]\s*(\d+(?:\s*[m]*))?$/
    );
    if (!match) {
      ctx.reply(
        "Mesaj, beklenen zaman formatıyla eşleşmiyor (örneğin: 10, 10m, 1s 30dk). Mesaj için yeni bir zaman dilimi girin:"
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
      ctx.reply("Zaman dilimi çözülemedi. Yeni bir zaman dilimi girin:");
      return ctx.wizard;
    }

    ctx.wizard.state.time = (hour * 60 + min) * 60000;

    const chats = await findAllChat();
    const chatString = ["-1 - Tümü"];
    for (const chat of chats) {
      chatString.push(`${chat.id} - ${chat.title}`);
    }
    chatString.push("🛑 Çıkış");

    const chatKeyboard = Markup.keyboard(chatString).oneTime().resize();

    ctx.reply("Mesajın kaydedileceği grup(ları) seçin:", chatKeyboard);
    return ctx.wizard.next();
  },
  async (ctx: AnyContext & ContextComplement, done: any) => {
    if (ctx.message.text == "🛑 Çıkış") return done();
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
      const chatString = ["-1 - Tümü"];
      for (const chat of chats) {
        chatString.push(`${chat.id} - ${chat.title}`);
      }
      chatString.push("🛑 Çıkış");

      const chatKeyboard = Markup.keyboard(chatString).oneTime().resize();
      ctx.reply(
        "Geçersiz grup! Seçeneklerden birini seçin ya da grup ID'lerini virgülle ayırarak gönderin.",
        chatKeyboard
      );
      return ctx.wizard;
    }

    await ctx.reply(`Gönderilecek mesaj şu:`);
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
      ctx.reply("Beklenmeyen bir cevap alındı.");
      return ctx.wizard.back();
    }
    if (ctx.message.text?.match(/✅ Evet|evet/gi)) {
      const result = await addAndSend({
        time: ctx.wizard.state.time,
        type: ctx.wizard.state.type,
        caption: ctx.wizard.state.caption,
        file_id: ctx.wizard.state.file_id,
        groups: ctx.wizard.state.groups,
      });
      if (result)
        ctx.reply("Mesaj kabul edildi", {
          reply_markup: { remove_keyboard: true },
        });
    }

    if (ctx.message.text?.match(/❌ Hayır|hayır/gi)) {
      ctx.reply("Kaydetmek istediğiniz mesajı gönderin.", exit_keyboard);
      return ctx.wizard.selectStep(1);
    }

    return done();
  }
);
