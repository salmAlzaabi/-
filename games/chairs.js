const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const db = require('../database.js');

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const TIME_TO_START = 30000;

const e = {
  hiding: "🪑",
  wave: "👋",
  active: "⚠️",
  question: "❓",
  player: "👥",
  start: "▶️",
  min: "📉",
  max: "📈",
  trophy: "🏆",
  shrug: "🤷",
  wrong: "❌",
  correct: "✅",
  reserved: "🔒",
  spot: "🚫",
  time: "🕒",
  greenButton: "🟩",
  redButton: "🟥",
};

const msg = {
    gameTitle: `${e.hiding} | لعبة الكراسي`,
    playerJoined: (userId) =>
      `${e.wave} | لقد انضممت إلى اللعبة، <@${userId}>!`,
    alreadyInGame: (userId) =>
      `${e.active} | أنت بالفعل في اللعبة، <@${userId}>!`,
    gameFull: `${e.active} | اللعبة ممتلئة!`,
    playerLeft: (userId) => `${e.wave} | لقد غادرت اللعبة، <@${userId}>.`,
    notInGame: (userId) => `${e.question} | لم تكن في اللعبة، <@${userId}>. `,
    notEnoughPlayers: `${e.player} | لا يوجد عدد كافٍ من اللاعبين لبدء اللعبة.`,
    gameStarting: `${e.start} | اللعبة تبدأ الآن!`,
    gameMinPlayers: `${e.min} | أدنى عدد للاعبين`,
    gameMaxPlayers: `${e.max} | أقصى عدد للاعبين`,
    gameEndWinner: (userId) => `${e.trophy} | الفائز هو <@${userId}>!`,
    gameEndNoWinner: `${e.shrug} | لا يوجد لاعبين متبقين. لا يوجد فائز في هذه الجولة.`,
    playerEliminated: (userId) =>
      `${e.wrong} | لقد ضغطت على الزر الأحمر وتم استبعادك، <@${userId}>.`,
    spotReserved: (userId) =>
      `${e.correct} | لقد حجزت مكانًا للجولة التالية، <@${userId}>!`,
    alreadyReserved: (userId) =>
      `${e.reserved} | لقد حجزت مكانًا بالفعل، <@${userId}>.`,
    spotTaken: (userId) =>
      `${e.spot} | هذا المكان محجوز بالفعل أو غير متاح، <@${userId}>.`,
    notInOrEliminated: (userId) =>
      `${e.spot} | أنت لست في اللعبة، <@${userId}>.`,
    playersKicked: (players) =>
      `${e.spot} | تم طرد: ${players.map((id) => `<@${id}>`).join(", ")}`,
    roundStartsSoon: `${e.time} | تبدأ الجولة القادمة بعد قليل...`,
    clickGreen: `${e.greenButton} | اضغط على الزر الأخضر بأسرع ما يمكن!`,
    clickRed: `${e.redButton} | لا تضغط على الزر الأحمر!`,
    noOneKicked: `${e.correct} | لم يتم طرد احد في هذه الجولة.`,
    playersEliminated: (players) =>
      `${e.wrong} | تم طرد لضغطهم على الزر الاحمر: ${players.map((id) => `<@${id}>`).join(", ")}`,
    gameInstructions: `- الهدف من اللعبة هو أن تحجز كرسيًا قبل نفاد الكراسي.\n- عند انتهاء كل جولة، يتم تقليل عدد الكراسي المتاحة.\n- يجب على اللاعبين النقر على الأزرار بأسرع ما يمكن لحجز مقعدهم.\n- إذا فشل اللاعب في حجز مقعد أو ضغط على زر محجوز بالفعل، يتم استبعاده من الجولة.\n- اللاعب الأخير الذي يبقى في اللعبة يفوز!`,
    newMessage: (nowTime, players, MAX_PLAYERS) => `
## **${e.hiding} | لعبة كراسي**
> **الوقت المتبقي لبدأ اللعبة: <t:${nowTime}:R>**
\n> **اللاعبين الحاليين (${players.length} / ${MAX_PLAYERS}) :**\n ${players
      .map((player) => `- <@${player}>`)
      .join("\n")}
      `,
    gameStartMessage: (nowTime, maxPlayers) =>
      `## **${e.hiding} | لعبة كراسي**\n> **الوقت المتبقي لبدأ اللعبة: <t:${nowTime}:R>**\n\n> **اللاعبين الحاليين (0 / ${maxPlayers})**`,
};

async function win(player, context) {
  try {
    db.addPoints(player, 10);
  } catch (err) {
    console.error(`[Chairs] Failed to add points: ${err}`);
    context.channel.send(`حدث خطأ أثناء إضافة النقاط للفائز.`);
  }
}

async function lose(player, context) {
}

module.exports = {
  name: 'chairs',
  aliases: ["كراسي"],
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {function} callback
   */
  execute(message, args, callback) {
    const nowTime = Math.floor(Date.now() / 1000 + TIME_TO_START / 1000);
    startGame(message, nowTime, callback);
  }
};

/**
 * Starts the game lobby.
 * @param {import('discord.js').Message} context The message that started the game.
 * @param {number} nowTime The calculated end time for the lobby.
 * @param {function} callback The function to call when the game ends.
 */
async function startGame(context, nowTime, callback) {
  const message = msg.gameStartMessage(nowTime, MAX_PLAYERS);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("join")
      .setEmoji("<:GPlay:1285562004873936979>")
      .setLabel("دخول")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("exit")
      .setEmoji("<:Gleave:1285563197092401214>")
      .setLabel("خروج")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("explain")
      .setEmoji("<:GBook:1285560569021202504>")
      .setLabel("شرح اللعبة ℹ️")
      .setStyle(ButtonStyle.Secondary),
  );

  const embed = new EmbedBuilder()
  .setTitle(msg.gameTitle)
  .setDescription(message)
  .setColor("#5865F2");

const sentMessage = await context.reply({
  embeds: [embed],
  components: [row],
  fetchReply: true,
});

  let players = [];
  let reservedPlayers = new Set();
  let eliminatedPlayers = new Set();
  let allButtons = new Set();

  const filter = (i) => i.customId === "join" || i.customId === "exit" || i.customId === "explain";
  const collector = sentMessage.createMessageComponentCollector({
    filter,
    time: TIME_TO_START,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "join") {
      if (players.length < MAX_PLAYERS) {
        if (!players.includes(i.user.id)) {
          players.push(i.user.id);
          await updateMessage(sentMessage, players, nowTime);
          await i.reply({
            content: msg.playerJoined(i.user.id),
            ephemeral: true,
          });
        } else {
          await i.reply({
            content: msg.alreadyInGame(i.user.id),
            ephemeral: true,
          });
        }
      } else {
        await i.reply({
          content: msg.gameFull,
          ephemeral: true,
        });
      }
    } else if (i.customId === "exit") {
      if (players.includes(i.user.id)) {
        players = players.filter((player) => player !== i.user.id);
        reservedPlayers.delete(i.user.id);
        eliminatedPlayers.delete(i.user.id);
        await updateMessage(sentMessage, players, nowTime);
        await i.reply({
          content: msg.playerLeft(i.user.id),
          ephemeral: true,
        });
      } else {
        await i.reply({
          content: msg.notInGame(i.user.id),
          ephemeral: true,
        });
      }
    } else if (i.customId === "explain") {
      const embed = new EmbedBuilder()
        .setTitle(msg.gameTitle)
        .setDescription(msg.gameInstructions)
        .addFields(
          {
            name: msg.gameMinPlayers,
            value: `${MIN_PLAYERS}`,
            inline: true,
          },
          {
            name: msg.gameMaxPlayers,
            value: `${MAX_PLAYERS}`,
            inline: true,
          },
        )
        .setColor("#5865F2");
      await i.reply({ embeds: [embed], ephemeral: true });
    }
  });

  collector.on("end", async () => {
    if (players.length < MIN_PLAYERS) {
      await context.channel.send(msg.notEnoughPlayers);
      callback(null, false, 0, "لم يكتمل عدد اللاعبين لبدء اللعبة."); 
      return;
    }

    row.components.forEach((button) => button.setDisabled(true));
    await sentMessage.edit({
        content: msg.newMessage(nowTime, players, MAX_PLAYERS),
        components: [row]
    });


    await context.channel.send(msg.gameStarting);
    await prepareRound(context, players, reservedPlayers, eliminatedPlayers, allButtons, callback);
  });
}

async function updateMessage(message, players, nowTime) {
  const newMessage = msg.newMessage(nowTime, players, MAX_PLAYERS);
  const embed = new EmbedBuilder()
  .setTitle(msg.gameTitle)
  .setDescription(newMessage)
  .setColor("#5865F2");

await message.edit({ embeds: [embed] });
}

/** Runs a single round of the game.
 * @param {import('discord.js').Message} context
 * @param {string[]} players
 * @param {Set<string>} reservedPlayers
 * @param {Set<string>} eliminatedPlayers
 * @param {Set<string>} allButtons
 * @param {function} callback
*/
async function prepareRound(context, players, reservedPlayers, eliminatedPlayers, allButtons, callback) {
  if (players.length === 1) {
    await win(players[0], context);
    await context.channel.send(msg.gameEndWinner(players[0]));
    callback(null, false, 0, "انتهت اللعبة! 🏆");
    return;
  } else if (players.length === 0) {
    await context.channel.send(msg.gameEndNoWinner);
    callback(null, false, 0, "انتهت الجولة ولم يتبقَ لاعبون.");
    return;
  }

  const numberOfButtons = players.length - 1;
  const reservedButtonIds = new Set();

  const initialRows = [];
  let initialRow = new ActionRowBuilder();
  for (let i = 0; i < numberOfButtons; i++) {
    if (initialRow.components.length === 5) {
      initialRows.push(initialRow);
      initialRow = new ActionRowBuilder();
    }
    initialRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`initialButton_${i}`)
        .setEmoji("<:Empty:1278953257728741451>")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );
  }
  if (initialRow.components.length > 0) {
    initialRows.push(initialRow);
  }

  const initialMessage = await context.channel.send({
    content: `... 3 ...`,
    components: initialRows,
  });

  setTimeout(async () => {
    allButtons.clear();
    const buttonsRows = [];
    let currentRow = new ActionRowBuilder();
    const isGreen = Math.random() < 0.5;

    for (let i = 0; i < numberOfButtons; i++) {
      const buttonId = isGreen ? `greenButton_${i}` : `redButton_${i}`;

      if (currentRow.components.length === 5) {
        buttonsRows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(buttonId)
          .setEmoji("<:Empty:1278953257728741451>")
          .setStyle(isGreen ? ButtonStyle.Success : ButtonStyle.Danger),
      );

      if (isGreen) {
        reservedButtonIds.add(buttonId);
      }
      allButtons.add(buttonId);
    }
    if (currentRow.components.length > 0) {
      buttonsRows.push(currentRow);
    }

    await initialMessage.edit({
      content: isGreen ? msg.clickGreen : msg.clickRed,
      components: buttonsRows,
    });

    const gameFilter = (i) => players.includes(i.user.id) && allButtons.has(i.customId);
    const gameCollector = initialMessage.createMessageComponentCollector({
      filter: gameFilter,
      time: 5000,
    });

    gameCollector.on("collect", async (i) => {
      if (!players.includes(i.user.id) || eliminatedPlayers.has(i.user.id)) {
        await i.reply({
          content: msg.notInOrEliminated(i.user.id),
          ephemeral: true,
        });
        return;
      }

      if (i.customId.startsWith("redButton_")) {
        players = players.filter((player) => player !== i.user.id);
        eliminatedPlayers.add(i.user.id);

        await lose(i.user.id, context);
        await i.reply({
          content: msg.playerEliminated(i.user.id),
          ephemeral: true,
        });
      } else if (i.customId.startsWith("greenButton_")) {
        if (reservedButtonIds.has(i.customId)) {
          if (!reservedPlayers.has(i.user.id)) {
            reservedPlayers.add(i.user.id);
            reservedButtonIds.delete(i.customId);
            await i.reply({
              content: msg.spotReserved(i.user.id),
              ephemeral: true,
            });
          } else {
            await i.reply({
              content: msg.alreadyReserved(i.user.id),
              ephemeral: true,
            });
          }
        } else {
          await i.reply({
            content: msg.spotTaken(i.user.id),
            ephemeral: true,
          });
        }
      }
    });

    gameCollector.on("end", async () => {
      
      buttonsRows.forEach(row => 
        row.components.forEach(button => button.setDisabled(true))
      );
      await initialMessage.edit({ components: buttonsRows });

      const eliminatedThisRound = Array.from(eliminatedPlayers);
      if (eliminatedThisRound.length > 0) {
        await context.channel.send(msg.playersEliminated(eliminatedThisRound));
      }

      if (isGreen) {
        const notReserved = players.filter(
          (player) => !reservedPlayers.has(player) && !eliminatedPlayers.has(player)
        );

        if (notReserved.length > 0) {
          notReserved.forEach(async (player) => {
            eliminatedPlayers.add(player);
            await lose(player, context);
          });
          await context.channel.send(msg.playersKicked(notReserved));
        } else if (eliminatedThisRound.length === 0) {
          await context.channel.send(msg.noOneKicked);
        }
        
        players = Array.from(reservedPlayers);

      } else {
        players = players.filter((player) => !eliminatedPlayers.has(player));
        if (eliminatedThisRound.length === 0) {
            await context.channel.send(msg.noOneKicked);
        }
      }

      reservedPlayers.clear();
      eliminatedPlayers.clear();

      if (players.length === 1) {
        await win(players[0], context);
        await context.channel.send(msg.gameEndWinner(players[0]));
        callback(null, false, 0, "انتهت اللعبة! 🏆");
        return;
      } else if (players.length === 0) {
        await context.channel.send(msg.gameEndNoWinner);
        callback(null, false, 0, "انتهت الجولة ولم يتبقَ لاعبون.");
        return;
      } else {
        await context.channel.send(msg.roundStartsSoon);
        await prepareRound(context, players, reservedPlayers, eliminatedPlayers, allButtons, callback);
      }
    });
  }, 5000);
}
