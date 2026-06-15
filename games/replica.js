const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const db = require('../database.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 15;
const TIME_TO_START = 30000;
const TIME_TO_ANSWER = 15000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI;
let geminiModel;

if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
}

let GAME_ACTIVE = false;
let players = [];

const ARABIC_LETTERS = [
    'أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
    'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'
];
const CATEGORIES = ['اسم إنسان', 'اسم حيوان', 'اسم نبات', 'اسم جماد', 'اسم دولة'];

module.exports = {
  name: 'replica',
  aliases: ["ريبلكا"],
  execute(message, args, callback) {
    if (!GEMINI_API_KEY) {
        message.reply("⚠️ | عذراً، لم يتم إعداد مفتاح Gemini API لهذه اللعبة. يرجى إضافته إلى ملف `.env`.");
        callback();
        return;
    }
    if (GAME_ACTIVE) {
      message.reply(`> **❌ | لقد بدأت لعبة أخرى بالفعل. الرجاء الانتظار حتى انتهاء اللعبة الحالية.**`);
      callback();
      return;
    }

    GAME_ACTIVE = true;
    const nowTime = Math.floor(Date.now() / 1000);
    startGame(message, nowTime, callback);
  }
};

function resetGameData() {
  GAME_ACTIVE = false;
  players = [];
}

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function getRandomWinPoints() {
    const min = 12;
  const max = 12;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function win(playerId, context) {
  try {
    const points = getRandomWinPoints();
    await db.addPoints(playerId, points);
  } catch (e) {
    console.error(`[Replica] Failed to apply win points: ${e}`)
  }
}
async function lose(playerId, context) { }

async function startGame(context, nowTime, callback) {
  players = [];

  const lobbyEmbed = new EmbedBuilder()
    .setTitle("🔠 | لعبة ريبلكا (نبات جماد حيوان)")
    .setDescription(`> **الوقت المتبقي لبدأ اللعبة: <t:${nowTime + TIME_TO_START / 1000}:R>**`)
    .addFields({ name: `اللاعبين الحاليين (0 / ${MAX_PLAYERS})`, value: "لا يوجد لاعبين بعد..." })
    .setColor("#5865F2")
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("join").setLabel("دخول").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("exit").setLabel("خروج").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("explain").setLabel("شرح اللعبة").setStyle(ButtonStyle.Secondary)
  );

  const sentMessage = await context.reply({
    embeds: [lobbyEmbed],
    components: [row],
    fetchReply: true,
  });

  const filter = (i) => i.customId === "join" || i.customId === "exit" || i.customId === "explain";
  const collector = sentMessage.createMessageComponentCollector({ filter, time: TIME_TO_START });

  collector.on("collect", async (i) => {
    if (i.customId === "join") {
      if (players.length < MAX_PLAYERS) {
        if (!players.some(p => p.id === i.user.id)) {
          players.push({
            id: i.user.id,
            displayName: i.user.displayName,
            avatarURL: i.user.displayAvatarURL({ extension: "png", forceStatic: true }) || "https://cdn.discordapp.com/embed/avatars/0.png",
          });
          await updateLobbyMessage(sentMessage, players, nowTime);
          await i.reply({ content: `لقد انضممت إلى اللعبة! 🎉`, ephemeral: true });
        } else {
          await i.reply({ content: `أنت بالفعل في اللعبة! 🚫`, ephemeral: true });
        }
      } else {
        await i.reply({ content: `اللعبة ممتلئة! 🚪`, ephemeral: true });
      }
    } else if (i.customId === "exit") {
      if (players.some(p => p.id === i.user.id)) {
        players = players.filter((p) => p.id !== i.user.id);
        await updateLobbyMessage(sentMessage, players, nowTime);
        await i.reply({ content: `لقد غادرت اللعبة. 👋`, ephemeral: true });
      } else {
        await i.reply({ content: `لم تكن في اللعبة. ❓`, ephemeral: true });
      }
    } else if (i.customId === "explain") {
        const explainEmbed = new EmbedBuilder()
            .setTitle("🔠 | شرح لعبة ريبلكا")
            .setColor("#5865F2")
            .setDescription(
`### **🃏・كيفية المشاركة:**
> 1. اضغط على زر "دخول" للمشاركة وزر "خروج" للمغادرة.
> 2. ستبدأ اللعبة بعد <t:${nowTime + TIME_TO_START / 1000}:R>.

### **📘・كيفية اللعب:**
> 1. يتم اختيار حرف عشوائي كل جولة.
> 2. لكل نوع: **اسم**, **حيوان**, **نبات**, **جماد** و **دولة**, يتم اختيار لاعب عشوائي ليرسل الكلمة التي تناسب الحرف.
> 3. إذا تأخر اللاعب أو كانت إجابته خاطئة (حسب الذكاء الاصطناعي)، يتم طرده.
> 4. آخر لاعب يبقى هو الفائز.`
            )
            .addFields(
                { name: "📉 | أدنى عدد للاعبين", value: `${MIN_PLAYERS}`, inline: true },
                { name: "📈 | أقصى عدد للاعبين", value: `${MAX_PLAYERS}`, inline: true }
            );
      await i.reply({ embeds: [explainEmbed], ephemeral: true });
    }
  });

  collector.on("end", async () => {
    try {
      row.components.forEach(button => button.setDisabled(true));
      const endEmbed = EmbedBuilder.from(lobbyEmbed)
          .setDescription("**انتهى وقت الانضمام للعبة!**")
          .setFields({
              name: `اللاعبين المشاركين (${players.length})`,
              value: players.length > 0 ? players.map((p) => `<@${p.id}>`).join(", ") : "لا يوجد"
          });
      await sentMessage.edit({ embeds: [endEmbed], components: [row] });
    } catch (error) { /* ignore */ }

    if (players.length < MIN_PLAYERS) {
      await context.channel.send(`لم يكن هناك عدد كافٍ من اللاعبين لبدء اللعبة. 🚪`);
      resetGameData();
      callback();
      return;
    }

    await context.channel.send(`👥 | اكتمل عدد اللاعبين! اللعبة ستبدأ الآن...`);
    await gameLoop(context, callback);
  });
}

async function updateLobbyMessage(sentMessage, lobbyPlayers, nowTime) {
    const playerList = lobbyPlayers.length > 0
        ? lobbyPlayers.map((p) => `<@${p.id}>`).join(", ")
        : "لا يوجد لاعبين بعد...";
    const updatedEmbed = EmbedBuilder.from(sentMessage.embeds[0])
        .setFields({ name: `اللاعبين الحاليين (${lobbyPlayers.length} / ${MAX_PLAYERS})`, value: playerList });
    await sentMessage.edit({ embeds: [updatedEmbed] });
}

async function gameLoop(context, callback) {
    if (await checkWin(context, callback)) return;

    const { eliminatedThisRound, survivors } = await runLetterRound(context, callback);

    const summaryEmbed = new EmbedBuilder()
        .setTitle(`🔠 | ملخص الجولة`)
        .addFields(
            { name: "الناجون", value: survivors.length > 0 ? survivors.map(p => `<@${p.id}>`).join('\n') : "لا أحد" },
            { name: "تم إقصائهم", value: eliminatedThisRound.length > 0 ? eliminatedThisRound.map(p => `<@${p.id}>`).join('\n') : "لا أحد" }
        )
        .setColor(eliminatedThisRound.length > 0 ? "#FF0000" : "#00FF00")
        .setTimestamp();

    await context.channel.send({ embeds: [summaryEmbed] });

    await sleep(4000);

    await gameLoop(context, callback);
}

async function runLetterRound(context, callback) {
    const letter = ARABIC_LETTERS[Math.floor(Math.random() * ARABIC_LETTERS.length)];
    await context.channel.send(`🔠 حرف هذه الجولة هو **${letter}**`);
    await sleep(2000);

    let eliminatedThisRound = [];
    let turnOrder = [...players].sort(() => 0.5 - Math.random());

    const turnsToPlay = Math.min(players.length, CATEGORIES.length);

    for (let i = 0; i < turnsToPlay; i++) {
        if (await checkWin(context, callback)) return { eliminatedThisRound, survivors: players };

        const category = CATEGORIES[i];
        const currentPlayer = turnOrder.pop();

        const survived = await askQuestion(context, currentPlayer, letter, category);

        if (!survived) {
            eliminatedThisRound.push(currentPlayer);
            players = players.filter(p => p.id !== currentPlayer.id);
            await lose(currentPlayer.id, context);
        }

        await sleep(2000);
    }

    return { eliminatedThisRound, survivors: players };
}

async function askQuestion(context, player, letter, category) {
    return new Promise(async (resolve) => {
        const questionMsg = await context.channel.send(`<@${player.id}> لديك **${TIME_TO_ANSWER / 1000} ثانية** لإرسال **${category}** يبدأ بحرف **${letter}**.`);

        const filter = m => m.author.id === player.id && m.channel.id === context.channel.id;

        const collector = context.channel.createMessageCollector({ filter, time: TIME_TO_ANSWER, max: 1 });

        collector.on('collect', async (msg) => {
            const answer = msg.content.trim();
            let isValid = false;

            const firstLetter = answer.charAt(0);
            let startsWithCorrectLetter = false;

            if (letter === 'أ') {
                startsWithCorrectLetter = (firstLetter === 'أ' || firstLetter === 'إ' || firstLetter === 'آ' || firstLetter === 'ا');
            } else {
                startsWithCorrectLetter = (firstLetter === letter);
            }

            if (startsWithCorrectLetter) {
                isValid = await validateAnswer(letter, category, answer);
            }

            if (isValid) {
                await msg.reply(`📌 إجابة <@${player.id}> صحيحة!`);
                resolve(true);
            } else {
                await msg.reply(`💣 | إجابة <@${player.id}> خاطئة! تم طردك من اللعبة.`);
                resolve(false);
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await questionMsg.reply(`💣 | تم طرد <@${player.id}> لعدم تفاعله في اللعبة.`);
                resolve(false);
            }
        });
    });
}

async function validateAnswer(letter, category, answer) {
    const prompt = `
نحن نلعب لعبة "نبات جماد حيوان".
الحرف المطلوب: "${letter}".
التصنيف: "${category}".
الإجابة التي قالها اللاعب: "${answer}".

تحقق إذا كانت الإجابة صحيحة بناءً على الحرف والتصنيف، مع مراعاة ما يلي:

- إذا كان الحرف "${letter}" هو "أ" أو "ا" أو "إ" أو "آ"، فكل هذه تُعتبر صحيحة بنفس المعنى (أي أن الكلمة التي تبدأ بأي منها تعتبر مقبولة).
- تجاهل التشكيل (الحركات).
- لا تكن صارمًا في التطابق الحرفي إن كانت الكلمة صحيحة لغويًا وتبدأ بنفس الصوت.
- يجب أن تكون الكلمة من التصنيف المطلوب (إنسان، حيوان، نبات، جماد، دولة).
- أجب بـ "نعم" فقط إذا كانت الإجابة صحيحة تمامًا ضمن هذه القواعد، أو "لا" إذا كانت خاطئة.
`;

    try {
        const result = await geminiModel.generateContent(prompt);

        let text;
        if (result.response?.text) {
            text = result.response.text();
        } else if (result.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
            text = result.response.candidates[0].content.parts[0].text;
        } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
            text = result.candidates[0].content.parts[0].text;
        } else {
            text = "[No text output found]";
        }

        text = (text || "").trim();

        console.log("\n==============================");
        console.log("🧠 [Gemini Prompt]:", prompt);
        console.log("💬 [Gemini Response]:", text);
        console.log("==============================\n");

        return text.includes("نعم");
    } catch (error) {
        console.error("❌ Error validating with Gemini:", error);
        return false;
    }
}

async function checkWin(context, callback) {
    if (players.length === 1) {
        const winner = players[0];
        await context.channel.send(`👑 - <@${winner.id}> فاز باللعبة!`);
        await win(winner.id, context);
        resetGameData();
        callback();
        return true;
    }

    if (players.length === 0) {
        await context.channel.send("❌ تم طرد جميع اللاعبين ، لم يفز أحد.");
        resetGameData();
        callback();
        return true;
    }

    return false;
}
