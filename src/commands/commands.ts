import { Context, Middleware, Scenes, session } from "telegraf";
import { createAddWizard } from "../utils/addWizard";
import { createDelWizard } from "../utils/delWizard";
import { bot } from "../bot/bot";
import { Update } from "typegram";
import { prisma } from "../db/prisma";
import { removeMessages } from "../db/messageController";
import { messageCheck } from "../utils/sender";
import { SceneContextScene } from "telegraf/typings/scenes";
import { createUpdateWizard } from "../utils/updateWizard";

const stage = new Scenes.Stage([
  createAddWizard("ADD", (ctx: Scenes.WizardContext) => {
    console.log(ctx.session);
  }),
  createDelWizard("DEL", (ctx: Scenes.WizardContext) => {
    console.log(ctx.session);
  }),
  createUpdateWizard("UPT", (ctx: Scenes.WizardContext) => {
    console.log(ctx.session);
  }),
]);

const commands = [
  { command: "komutlar", description: "Komutları Listeler" },
  { command: "ekle", description: "Yeni bir mesaj ekler" },
  {
    command: "kayit",
    description: "Botun mesaj göndermesi için sohbeti kaydeder",
  },
  { command: "temizle", description: "Tüm mesajları temizler" },
  { command: "sil", description: "Tek bir mesajı siler" },
  { command: "guncelle", description: "Seçilen mesajı günceller" },
];

interface ChatContext {
  chat: {
    id: number;
    title?: string;
  };
}

const wait = async (ms: number) => {
  await new Promise((r) => setTimeout(r, ms));
};

async function is_adm(ctx: Context) {
  let adms = await ctx.getChatAdministrators().catch((err) => []);
  return adms.find((adm) => ctx.from?.id === adm.user.id);
}

async function setup() {
  bot.start((ctx) => {
    ctx.reply(
      "Merhaba, ben Jack. Mesajları planlayıp gönderen bir botum. Başlamak için /komutlar yazın."
    );
  });

  bot.telegram.setMyCommands(commands);

  bot.command("komutlar", (ctx) => {
    let message: string = "";
    bot.telegram
      .getMyCommands()
      .then((commands) => {
        commands.forEach((command, i) => {
          message +=
            i + " - /" + command.command + ": " + command.description + "\n";
        });
        ctx.reply(message).catch((err) => {
          wait(err.response.parameters.retry_after * 1001);
        });
      })
      .catch((err) => {
        console.log("Komutları listeleme hatası: " + err);
      });
  });

  bot.command("kayit", async (ctx: Context & ChatContext) => {
    const result = await is_adm(ctx);
    if (result) {
      const chatExist = await prisma.chat.findFirst({
        where: {
          chatid: ctx.chat.id,
        },
      });

      if (!chatExist) {
        const createChat = await prisma.chat.create({
          data: {
            chatid: ctx.chat.id,
            title: ctx.chat?.title || "İsimsiz",
          },
        });
        ctx.reply(
          `Sohbet ${ctx.chat.title} (id: ${ctx.chat.id}) başarıyla kaydedildi.`
        );
      } else {
        ctx.reply(
          `Sohbet ${ctx.chat.title} (id: ${ctx.chat.id}) zaten kaydedildi.`
        );
      }
    }
  });

  messageCheck();
  bot.command("temizle", async (ctx) => {
    if (ctx.message.chat.type.match(/group|supergroup/)) {
      const isadm = await is_adm(ctx);
      if (isadm) removeMessages();
      else ctx.reply("Sadece yöneticiler bu komutu kullanabilir");
    }
  });

  bot.use(session());
  bot.use(stage.middleware());
  // addStage.hears("❌ Çıkış", ctx => ctx.scene.leave());
  bot.command("ekle", (ctx) => ctx.scene.enter("ADD"));
  bot.command("sil", (ctx) => ctx.scene.enter("DEL"));
  bot.command("guncelle", (ctx) => ctx.scene.enter("UPT"));
}

function launch() {
  console.log("Bot Başlatılıyor");
  bot.launch();
}

export default { setup, launch };
