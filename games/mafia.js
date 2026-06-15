const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionWebhook,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const path = require("path");
const db = require('../database.js');
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const mafiaConfig = {
  ROUND_BANNER: "../img/mafia/lobby.png",
  MAFIA_ICON: "../img/mafia/mafia.png",
  CITIZEN_ICON: "../img/mafia/citizen.png",
  DOCTOR_ICON: "../img/mafia/doctor.png",
  MAFIA_WIN_BANNER: "../img/mafia/mafiaWin.png",
  CITIZEN_WIN_BANNER: "../img/mafia/CitizenWin.png",
  MIN_PLAYERS: 5,
  MAX_PLAYERS: 20,
  TIME_TO_START: 25000,
  VOTE_COUNT_EMOJIS: [
    "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
    "<:GEleven:1285946860951044128>", "<:GTwelve:1285946918383386674>",
    "<:GThirteen:1285946956157423671>", "<:GFourteen:1285947007910940805>",
    "<:GFifteen:1285947059454611528>", "<:GSixteen:1285947087938257020>",
    "<:GSeventeen:1285947127679422508>", "<:GEighteen:1285947168305320000>",
    "<:GNineteen:1285947288744759307>", "<:GTwenty:1285947320508350558>",
  ],
};

try {
  GlobalFonts.registerFromPath(
    path.join(__dirname, "../img/Fonts/IBMBold.ttf"),
    "IBMBold"
  );
} catch (e) {
  console.warn("[Mafia] Could not load custom font. Using default.");
}


const { MIN_PLAYERS, MAX_PLAYERS, TIME_TO_START, VOTE_COUNT_EMOJIS } = mafiaConfig;
const CMD_BANNER = path.join(__dirname, "../img/mafia/lobby.png");
const ROUND_BANNER = path.join(__dirname, "../img/mafia/background.png");
const MAFIA_ICON = path.join(__dirname, "../img/mafia/mafia.png");
const CITIZEN_ICON = path.join(__dirname, "../img/mafia/citizen.png");
const DOCTOR_ICON = path.join(__dirname, "../img/mafia/doctor.png");
const MAFIA_WIN_BANNER = path.join(__dirname, "../img/mafia/mafiaWin.png");
const CITIZEN_WIN_BANNER = path.join(__dirname, "../img/mafia/CitizenWin.png");

let GAME_ACTIVE = false;
let players = [];

module.exports = {
  name: 'mafia',
  aliases: ["مافيا"],
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {function} callback
   */
  execute(message, args, callback) {
    if (GAME_ACTIVE) {
      message.reply(`> **❌ | لقد بدأت لعبة أخرى بالفعل. الرجاء ار حتى انتهاء اللعبة الحالية.**`);
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
    const min = 20;
  const max = 20;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function win(playerId, context) {
  try {
    const points = getRandomWinPoints();
    await db.addPoints(playerId, points);
    console.log(`[Mafia] Gave ${points} points to winner ${playerId}`);
  } catch (e) { 
    console.error(`[Mafia] Failed to apply win points: ${e}`) 
  }
}

async function lose(playerId, context) {
}

async function startGame(context, nowTime, callback) {
  players = [];

  const lobbyEmbed = new EmbedBuilder()
    .setTitle("🕵️ | لعبة المافيا")
    .setDescription(`> **الوقت المتبقي لبدأ اللعبة: <t:${nowTime + TIME_TO_START / 1000}:R>**`)
    .addFields({ name: `اللاعبين الحاليين (0 / ${MAX_PLAYERS})`, value: "لا يوجد لاعبين بعد..." })
    .setImage(`attachment://${path.basename(CMD_BANNER)}`)
    .setColor("#5865F2")
    .setTimestamp();

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
      .setLabel("شرح اللعبة ")
      .setStyle(ButtonStyle.Secondary)
  );

  let sentMessage;
  try {
    sentMessage = await context.reply({
      embeds: [lobbyEmbed],
      components: [row],
      files: [CMD_BANNER],
      fetchReply: true,
    });
    
    const filter = (i) => i.customId === "join" || i.customId === "exit" || i.customId === "explain";
    const collector = sentMessage.createMessageComponentCollector({
      filter,
      time: TIME_TO_START,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "join") {
        if (players.length < MAX_PLAYERS) {
          const playerExists = players.some((player) => player.id === i.user.id);
          if (!playerExists) {
            players.push({
              id: i.user.id,
              displayName: i.user.displayName,
              avatarURL: i.user.displayAvatarURL({ extension: "png", forceStatic: true }) || "https://cdn.discordapp.com/embed/avatars/0.png",
              msgInfo: {
                applicationId: i.applicationId,
                interactionToken: i.token,
                messageId: i.id,
              },
              role: null,
              voteCount: 0,
              takeVote: false,
            });
            await updateMessage(sentMessage, players, nowTime);
            await i.reply({ content: `لقد انضممت إلى اللعبة، <@${i.user.id}>! 🎉`, ephemeral: true });
          } else {
            await i.reply({ content: `أنت بالفعل في اللعبة، <@${i.user.id}>! 🚫`, ephemeral: true });
          }
        } else {
          await i.reply({ content: `اللعبة ممتلئة! 🚪`, ephemeral: true });
        }
      } else if (i.customId === "exit") {
        const playerExists = players.some((player) => player.id === i.user.id);
        if (playerExists) {
          players = players.filter((player) => player.id !== i.user.id);
          await updateMessage(sentMessage, players, nowTime);
          await i.reply({ content: `لقد غادرت اللعبة، <@${i.user.id}>. 👋`, ephemeral: true });
        } else {
          await i.reply({ content: `لم تكن في اللعبة، <@${i.user.id}>. ❓`, ephemeral: true });
        }
      } else if (i.customId === "explain") {
        const embed = new EmbedBuilder()
          .setTitle("🕵️ | شرح لعبة المافيا")
          .setDescription(
            `
### **🃏・كيفية المشاركة:**
> 1. اضغط على زر "دخول" للمشاركة وزر "خروج" للمغادرة.
> 2. ستبدأ اللعبة بعد <t:${Math.floor(Date.now() / 1000) + TIME_TO_START / 1000}:R>.
        
### **📘・كيفية اللعب:**
> 1. سيتم توزيع الأدوار على اللاعبين بشكل عشوائي بين مافيا، مواطنين، وطبيب واحد.
> 2. في كل جولة، ستقوم المافيا بالتصويت لقتل شخص واحد.
> 3. يقوم الطبيب بتحديد شخص لحمايته. إذا حمى الطبيب ضحية المافيا، ينجو الشخص.
> 4. بعد ذلك، يصوت جميع اللاعبين (الناجين) لطرد شخص يعتقدون أنه من المافيا.
> 5. تنتهي اللعبة بفوز المواطنين إذا تم طرد كل المافيا، أو بفوز المافيا إذا تساوى عددهم مع المواطنين.
          `
          )
          .addFields(
            { name: "📉 | أدنى عدد للاعبين", value: `${MIN_PLAYERS}`, inline: true },
            { name: "📈 | أقصى عدد للاعبين", value: `${MAX_PLAYERS}`, inline: true }
          )
          .setColor("#5865F2");
        await i.reply({ embeds: [embed], ephemeral: true });
      }
    });

    collector.on("end", async () => {
      try {
        row.components.forEach(button => button.setDisabled(true));
        
        const endEmbed = EmbedBuilder.from(lobbyEmbed)
            .setDescription("**انتهى وقت الانضمام للعبة!**")
            .setFields({ 
                name: `اللاعبين المشاركين (${players.length} / ${MAX_PLAYERS})`, 
                value: players.length > 0 ? players.map((p) => `<@${p.id}>`).join(", ") : "لا يوجد"
            });
            
        await sentMessage.edit({
          embeds: [endEmbed],
          components: [row],
        });
      } catch (error) {
        console.error("Failed to disable join buttons:", error);
      }

      if (players.length < MIN_PLAYERS) {
        await context.channel.send(`لم يكن هناك عدد كافٍ من اللاعبين لبدء اللعبة. 🚪`);
        resetGameData();
        callback(null, false, 0, "Not enough players");
        return;
      } else {
        assignRoles(players);
        const AllPlayers = [...players];
        await sendRoleMessages(context, players, AllPlayers);
        await gameRound(context, players, AllPlayers, callback);
      }
    });
  } catch (error) {
    console.error("Error starting the game:", error);
    resetGameData();
    callback(null, false, 0, "Error starting game");
    if (context.channel) {
      await context.channel.send("حدث خطأ أثناء بدء اللعبة. يرجى المحاولة مرة أخرى.");
    }
  }
}

function assignRoles(players) {
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const mafiaCount = players.length < 5 ? 1 : players.length < 10 ? 2 : 3;
  
  shuffledPlayers.slice(0, mafiaCount).forEach(p => p.role = "mafia");
  shuffledPlayers.slice(mafiaCount, mafiaCount + 1).forEach(p => p.role = "doctor");
  shuffledPlayers.slice(mafiaCount + 1).forEach(p => p.role = "citizen");
}

async function sendRoleMessages(context, players, AllPlayers) {
  for (const player of players) {
    try {
      const webhook = new InteractionWebhook(
        context.client,
        player.msgInfo.applicationId,
        player.msgInfo.interactionToken
      );

      let rolesMessage = {
        mafia: "🕵️ | تم اختيارك انت كـ **مافيا**. يجب عليكم محاولة اغتيال جميع اللاعبين بدون اكتشافكم",
        doctor: "🧑‍⚕️ | تم اختيارك انت كـ **الطبيب**. في كل جولة يمكنك حماية شخص واحد من هجوم المافيا",
        citizen: "👥 | تم اختيارك انت كـ **مواطن**. في كل جولة يجب عليك التحقق مع جميع اللاعبين لأكتشاف المافيا وطردهم من اللعبة",
      };
      await webhook.send({
        content: rolesMessage[player.role] || rolesMessage.citizen,
        ephemeral: true,
      });
    } catch (error) {
      console.error(`Failed to send role to user ${player.id}:`, error);
      players = players.filter(p => p.id !== player.id);
      AllPlayers = AllPlayers.filter(p => p.id !== player.id);
      await context.channel.send(`⚠️ | تعذر إرسال الدور إلى <@${player.id}>. تم إزالته من اللعبة.`);
    }
  }
  
  await sleep(1000);

  try {
    const gameImage = await drawGame(context, AllPlayers, "start");
    await context.channel.send({
        content: `✅ | تم توزيع الرتب على اللاعبين. ستبدأ الجولة الأولى في بضع ثواني...`,
        files: [gameImage]
    });
  } catch (e) {
    console.error("Failed to draw start game image:", e);
    await context.channel.send(`✅ | تم توزيع الرتب على اللاعبين. ستبدأ الجولة الأولى في بضع ثواني...`);
  }
  await sleep(4000);
}

async function disableButtons(buttonRows) {
  return buttonRows.map(row => {
    const newRow = new ActionRowBuilder();
    row.components.forEach(button => {
      newRow.addComponents(ButtonBuilder.from(button).setDisabled(true));
    });
    return newRow;
  });
}

async function mafiaRound(context, players, callback) {
  const mafiaPlayers = players.filter((player) => player.role === "mafia");
  
  if (mafiaPlayers.length === 0) {
    return { topVotedPlayers: null, players };
  }
  
  const citizens = players.filter((player) => player.role !== "mafia");
  if (citizens.length === 0) {
      return { topVotedPlayers: null, players };
  }

  let buttons = await generateButtons(citizens);
  for (const player of mafiaPlayers) {
    try {
      const webhook = new InteractionWebhook(
        context.client,
        player.msgInfo.applicationId,
        player.msgInfo.interactionToken
      );
      const msgInfo = await webhook.send({
        content: "🔪 | صوت للاعب الذي تريد قتله (25 ثانية)",
        components: buttons,
        ephemeral: true,
        fetchReply: true
      });
      player.msgInfo.messageId = msgInfo.id;
    } catch (e) {
        console.error(`Failed to send mafia vote to ${player.id}`, e);
        player.takeVote = true; 
    }
  }

  await context.channel.send("🔪 | جاري انتظار المافيا لاختيار شخص لقتله...");

  return new Promise((resolve) => {
    const filter = (i) => i.customId.startsWith("vote_") && mafiaPlayers.some(p => p.id === i.user.id);
    const collector = context.channel.createMessageComponentCollector({
      filter,
      time: 25000,
    });

    collector.on("collect", async (i) => {
      const playerId = i.customId.split("_")[1];
      const mafiaVoteStatus = players.find((player) => player.id === i.user.id);

      if (mafiaVoteStatus.takeVote) {
        await i.reply({ content: `لقد صوتت بالفعل`, ephemeral: true });
        return;
      }

      const votedPlayer = players.find((player) => player.id === playerId);
      if (votedPlayer) {
        votedPlayer.voteCount++;
      }
      mafiaVoteStatus.takeVote = true;
      await i.reply({ content: `✅ | لقد صوتت على <@${votedPlayer.id}>`, ephemeral: true });

      const updatedButtons = await generateButtons(citizens);
      for (const player of mafiaPlayers) {
        if (!player.msgInfo.messageId) continue;
        try {
          const webhook = new InteractionWebhook(context.client, player.msgInfo.applicationId, player.msgInfo.interactionToken);
          await webhook.editMessage(player.msgInfo.messageId, { components: updatedButtons });
        } catch (error) {
        }
      }
    });

    collector.on("end", async () => {
      const disabledButtons = await disableButtons(buttons);
      for (const player of mafiaPlayers) {
        if (!player.msgInfo.messageId) continue;
        try {
          const webhook = new InteractionWebhook(context.client, player.msgInfo.applicationId, player.msgInfo.interactionToken);
          await webhook.editMessage(player.msgInfo.messageId, {
            components: disabledButtons,
            content: "🔪 | انتهى وقت التصويت"
          });
        } catch (error) {
        }
      }

      const mafiaPlayersWhoDidNotVote = mafiaPlayers.filter((p) => !p.takeVote);

      if (mafiaPlayersWhoDidNotVote.length === mafiaPlayers.length) {
        await context.channel.send("🏆 | لم يقم أي من المافيا بالتصويت! سيتم طردهم جميعاً وفوز المواطنين!");
        resolve({ topVotedPlayers: "citizens_win", players: players });
        return;
      }
      
      const highestVoteCount = Math.max(...citizens.map((player) => player.voteCount), 0);
      
      if (highestVoteCount === 0) {
        await context.channel.send("⏭️ | لم يتم اتفاق المافيا على شخص محدد، سيتم تخطي الاغتيال.");
        resolve({ topVotedPlayers: null, players });
        return;
      }
      
      const topVotedPlayers = citizens.filter((player) => player.voteCount === highestVoteCount);

      if (topVotedPlayers.length > 1) {
        await context.channel.send("⏭️ | بسبب تعادل التصويت بين المافيا، تم تخطي الاغتيال.");
        resolve({ topVotedPlayers: null, players });
      } else if (topVotedPlayers.length === 1) {
        await context.channel.send(`🔪 | اختارت المافيا الشخص الذي سيتم اغتياله.`);
        resolve({ topVotedPlayers: topVotedPlayers[0], players });
      } else {
        resolve({ topVotedPlayers: null, players });
      }
    });
  });
}

async function updateMessage(sentMessage, players, nowTime) {
    const playerList = players.length > 0 
        ? players.map((p) => `<@${p.id}>`).join(", ")
        : "لا يوجد لاعبين بعد...";

    const updatedEmbed = new EmbedBuilder()
        .setTitle("🕵️ | لعبة المافيا")
        .setDescription(`> **الوقت المتبقي لبدأ اللعبة: <t:${nowTime + TIME_TO_START / 1000}:R>**`)
        .setFields({ name: `اللاعبين الحاليين (${players.length} / ${MAX_PLAYERS})`, value: playerList })
        .setImage(`attachment://${path.basename(CMD_BANNER)}`)
        .setColor("#5865F2")
        .setTimestamp();
        
    await sentMessage.edit({ embeds: [updatedEmbed] });
}

async function doctorRound(context, players) {
  const doctorPlayer = players.find((player) => player.role === "doctor");
  if (!doctorPlayer) {
    return { savedPlayer: null, players };
  }

  let buttons = await generateButtons(players);
  let msgInfo;

  try {
    const webhook = new InteractionWebhook(
        context.client,
        doctorPlayer.msgInfo.applicationId,
        doctorPlayer.msgInfo.interactionToken
    );
    msgInfo = await webhook.send({
        content: "🩺 | صوت للاعب الذي تريد انقاذه (25 ثانية)",
        components: buttons,
        ephemeral: true,
        fetchReply: true
    });
    doctorPlayer.msgInfo.messageId = msgInfo.id;
  } catch (e) {
      console.error(`Failed to send doctor vote to ${doctorPlayer.id}`, e);
      await context.channel.send("🩺 | لم يتمكن الطبيب من التصويت هذا الدور.");
      return { savedPlayer: null, players };
  }


  await context.channel.send("🩺 | جاري انتظار الطبيب لاختيار شخص لانقاذه...");

  return new Promise((resolve) => {
    const filter = (i) => i.customId.startsWith("vote_") && i.user.id === doctorPlayer.id;
    const collector = context.channel.createMessageComponentCollector({
      filter,
      time: 25000,
    });

    let votedPlayer = null;

    collector.on("collect", async (i) => {
      const playerId = i.customId.split("_")[1];
      if (doctorPlayer.takeVote) {
        await i.reply({ content: `لقد صوتت بالفعل`, ephemeral: true });
        return;
      }

      votedPlayer = players.find((player) => player.id === playerId);
      doctorPlayer.takeVote = true;
      await i.reply({ content: `✅ | لقد صوتت على <@${votedPlayer.id}>`, ephemeral: true });
    });

    collector.on("end", async () => {
      if (doctorPlayer) {
        try {
          const disabledButtons = await disableButtons(buttons);
          const webhook = new InteractionWebhook(context.client, doctorPlayer.msgInfo.applicationId, doctorPlayer.msgInfo.interactionToken);
          await webhook.editMessage(doctorPlayer.msgInfo.messageId, {
            components: disabledButtons,
            content: "🩺 | انتهى وقت التصويت"
          });
        } catch (error) {
        }
      }

      if (doctorPlayer.takeVote === true) {
        await context.channel.send(`💊 | اختار الطبيب الشخص الذي سيحميه.`);
        resolve({ savedPlayer: votedPlayer, players });
      } else {
        await context.channel.send(`💊 | لم يقم الطبيب بإنقاذ أي شخص!`);
        resolve({ savedPlayer: null, players });
      }
    });
  });
}

async function citizenRound(context, players) {
  if (players.length === 0) {
    return { topVotedPlayers: null, players };
  }
  
  const buttons = await generateButtons(players);
  const investigateMessage = await context.channel.send({
    content: "🔍 | لديكم 25 ثانية لاختيار شخص لطرده من اللعبة",
    components: buttons
  });

  return new Promise((resolve) => {
    const filter = (i) => i.customId.startsWith("vote_") && players.some(p => p.id === i.user.id);
    const collector = context.channel.createMessageComponentCollector({
      filter,
      time: 25000,
    });

    collector.on("collect", async (i) => {
      const playerId = i.customId.split("_")[1];
      const playerVoteStatus = players.find((p) => p.id === i.user.id);

      if (!playerVoteStatus) {
        await i.reply({ content: `🚫 | لا يمكنك التصويت.`, ephemeral: true });
        return;
      }
      if (playerVoteStatus.takeVote) {
        await i.reply({ content: `لقد صوتت بالفعل`, ephemeral: true });
        return;
      }
      const votedPlayer = players.find((player) => player.id === playerId);
      if (!votedPlayer) {
        await i.reply({ content: `🚫 | هذا اللاعب غير موجود.`, ephemeral: true });
        return;
      }

      votedPlayer.voteCount++;
      playerVoteStatus.takeVote = true;
      await i.reply({ content: `✅ | لقد صوتت على <@${votedPlayer.id}>`, ephemeral: true });

      const updatedButtons = await generateButtons(players);
      await investigateMessage.edit({ components: updatedButtons });
    });

    collector.on("end", async () => {
      try {
        const disabledButtons = await disableButtons(await generateButtons(players));
        await investigateMessage.edit({
          content: "🔍 | انتهت جولة التصويت!",
          components: disabledButtons
        });
      } catch (error) {
      }
      
      const playersWhoDidNotVote = players.filter((player) => !player.takeVote);
      if (playersWhoDidNotVote.length > 0) {
          await context.channel.send(`🔍 | لم يقم بالتصويت: ${playersWhoDidNotVote.map((p) => `<@${p.id}>`).join(", ")}`);
      }

      const highestVoteCount = Math.max(...players.map((p) => p.voteCount), 0);
      
      if (highestVoteCount === 0) {
        await context.channel.send("⏭️ | لم يتم التصويت لأي لاعب، سيتم تخطي الطرد.");
        resolve({ topVotedPlayers: "draw", players });
        return;
      }
      
      const topVotedPlayers = players.filter((p) => p.voteCount === highestVoteCount);

      if (topVotedPlayers.length > 1) {
        await context.channel.send("⏭️ | بسبب تعادل التصويت، تم تخطي الطرد.");
        resolve({ topVotedPlayers: "draw", players });
      } else if (topVotedPlayers.length === 1) {
        const kickedPlayer = topVotedPlayers[0];
        const roleName = kickedPlayer.role === "doctor" ? "طبيب" : kickedPlayer.role === "mafia" ? "مافيا" : "مواطن";
        
        await context.channel.send(`🔍 | تم طرد <@${kickedPlayer.id}>، وهذا اللاعب كان **${roleName}**`);
        players = players.filter((player) => player.id !== kickedPlayer.id);
        resolve({ topVotedPlayers: kickedPlayer, players });
      } else {
        resolve({ topVotedPlayers: "draw", players });
      }
    });
  });
}

async function gameRound(context, players, AllPlayers, callback) {
  if ((await checkWin(context, players, AllPlayers, callback)) === true) return;

  players.forEach((player) => {
    player.voteCount = 0;
    player.takeVote = false;
  });

  let { topVotedPlayers: votedPlayer, players: updatedPlayers } = await mafiaRound(context, players, callback);
  
  if (votedPlayer === "citizens_win") {
    const allCitizens = AllPlayers.filter(p => p.role !== 'mafia');
    const allMafia = AllPlayers.filter(p => p.role === 'mafia');
    try {
        await context.channel.send({
            content: `🎉 | لقد فاز المواطنون والطبيب باللعبة بسبب عدم تصويت المافيا! الفائزون: ${allCitizens.map((p) => `<@${p.id}>`).join(", ")}`,
            files: [await drawGame(context, AllPlayers, "end", "citizen")]
        });
    } catch(e) {
        console.error("Failed to draw game image", e);
        await context.channel.send(`🎉 | لقد فاز المواطنون والطبيب باللعبة بسبب عدم تصويت المافيا! الفائزون: ${allCitizens.map((p) => `<@${p.id}>`).join(", ")}`);
    }
    for (const p of allCitizens) await win(p.id, context);
    for (const p of allMafia) await lose(p.id, context);
    resetGameData();
    callback(null, false, 0, "Citizens win!");
    return;
  }
  
  players = updatedPlayers;
  if ((await checkWin(context, players, AllPlayers, callback)) === true) return;

  let savedPlayer;
  if (votedPlayer) {
    players.forEach(p => { p.voteCount = 0; p.takeVote = false; });
    const { savedPlayer: saved, players: updatedPlayersDoc } = await doctorRound(context, players);
    savedPlayer = saved;
    players = updatedPlayersDoc;
    if ((await checkWin(context, players, AllPlayers, callback)) === true) return;

    if (savedPlayer && votedPlayer.id === savedPlayer.id) {
        await context.channel.send(`🩺 | لقد نجح الطبيب في حماية <@${savedPlayer.id}> من الاغتيال!`);
    } else {
        const roleName = votedPlayer.role === "doctor" ? "طبيب" : votedPlayer.role === "mafia" ? "مافيا" : "مواطن";
        await context.channel.send(`🔪 | لقد قتلت المافيا <@${votedPlayer.id}> وكان هذا الشخص **${roleName}**`);
        players = players.filter((player) => player.id !== votedPlayer.id);
        if ((await checkWin(context, players, AllPlayers, callback)) === true) return;
    }
  } else {
  }

  players.forEach((player) => {
    player.voteCount = 0;
    player.takeVote = false;
  });

  const { topVotedPlayers: votedSuspect, players: newUpdatedPlayers } = await citizenRound(context, players);
  players = newUpdatedPlayers;

  if (votedSuspect === "draw") {
  }
  
  if ((await checkWin(context, players, AllPlayers, callback)) === true) return;

  await context.channel.send("--- 🌆 تبدأ جولة جديدة 🌆 ---");
  await sleep(3000);
  await gameRound(context, players, AllPlayers, callback);
}

async function generateButtons(players) {
  const buttons = players.map((player) => {
    return new ButtonBuilder()
      .setCustomId(`vote_${player.id}`)
      .setEmoji(VOTE_COUNT_EMOJIS[player.voteCount] || "❌")
      .setLabel(player.displayName.substring(0, 80))
      .setStyle(ButtonStyle.Primary);
  });

  let rows = [];
  while (buttons.length) {
    rows.push(new ActionRowBuilder().addComponents(...buttons.splice(0, 5)));
  }
  return rows;
}

async function checkWin(context, players, AllPlayers, callback) {
  const mafiaPlayers = players.filter((player) => player.role === "mafia");
  const citizens = players.filter((player) => player.role !== "mafia");
  
  const allMafiaPlayers = AllPlayers.filter((player) => player.role === "mafia");
  const allCitizens = AllPlayers.filter((player) => player.role !== "mafia");

  let gameEndImage;

  if (mafiaPlayers.length >= citizens.length && citizens.length > 0) {
    try {
        gameEndImage = await drawGame(context, AllPlayers, "end", "mafia");
    } catch(e) { console.error("Failed to draw mafia win image:", e); }
    
    await context.channel.send({
      content: `🎉 | لقد فازت المافيا باللعبة! الفائزون: ${allMafiaPlayers.map((p) => `<@${p.id}>`).join(", ")}`,
      files: gameEndImage ? [gameEndImage] : []
    });

    for (const p of allMafiaPlayers) await win(p.id, context);
    for (const p of allCitizens) await lose(p.id, context);

    resetGameData();
    callback(null, false, 0, "Mafia win!");
    return true;

  } else if (mafiaPlayers.length === 0) {
    try {
        gameEndImage = await drawGame(context, AllPlayers, "end", "citizen");
    } catch(e) { console.error("Failed to draw citizen win image:", e); }

    await context.channel.send({
      content: `🎉 | لقد فاز المواطنون والطبيب! الفائزون: ${allCitizens.map((p) => `<@${p.id}>`).join(", ")}`,
      files: gameEndImage ? [gameEndImage] : []
    });

    for (const p of allCitizens) await win(p.id, context);
    for (const p of allMafiaPlayers) await lose(p.id, context);

    resetGameData();
    callback(null, false, 0, "Citizen win!");
    return true;
  }
  
  return false;
}

async function noWinner(context, callback) {
  resetGameData();
  callback(null, false, 0, "No winner");
  return await context.channel.send("🎉 | لم يقم أحد بالتصويت، لذلك تم طرد جميع اللاعبين ولا يوجد فائز.");
}

async function drawGame(context, allPlayers, type, winnerType) {
  const canvas = createCanvas(626, 339);
  const ctx = canvas.getContext("2d");
  
  const loadImg = async (filePath) => {
      try {
          return await loadImage(filePath);
      } catch (e) {
          console.error(`[Mafia] Failed to load image: ${filePath}`, e);
          return null;
      }
  };

  if (type === "start") {
    const banner = await loadImg(ROUND_BANNER);
    if(banner) ctx.drawImage(banner, 0, 0, 626, 339);
    else { ctx.fillStyle = "#333"; ctx.fillRect(0, 0, 626, 339); }

    const mafiaIcon = await loadImg(MAFIA_ICON);
    const citizenIcon = await loadImg(CITIZEN_ICON);
    const doctorIcon = await loadImg(DOCTOR_ICON);

    const mafiaPlayers = allPlayers.filter((p) => p.role === "mafia");
    const citizenPlayers = allPlayers.filter((p) => p.role === "citizen");
    const doctorPlayers = allPlayers.filter((p) => p.role === "doctor");

    const mafiaIconWidth = 22, mafiaIconHeight = 43, iconGap = 9, iconsPerRow = 5;
    const mafiaContainerWidth = 194, mafiaContainerX = 88, mafiaContainerY = 150;

    const drawIcons = (icon, players, cX, cY, cW, iW, iH) => {
      if (!icon) return;
      players.forEach((player, index) => {
        const row = Math.floor(index / iconsPerRow);
        const col = index % iconsPerRow;
        const xOffset = cX + (cW - (iconsPerRow * iW + (iconsPerRow - 1) * iconGap)) / 2;
        const xPos = xOffset + col * (iW + iconGap);
        const yPos = cY + row * (iH + iconGap);
        ctx.drawImage(icon, xPos, yPos, iW, iH);
      });
    };

    drawIcons(mafiaIcon, mafiaPlayers, mafiaContainerX, mafiaContainerY, mafiaContainerWidth, mafiaIconWidth, mafiaIconHeight);

    const citizenIconWidth = 27, iconHeight = 43;
    const citizenContainerX = 345, citizenContainerY = 150;
    
    if(citizenIcon) citizenPlayers.forEach((player, index) => {
        const row = Math.floor(index / iconsPerRow);
        const col = index % iconsPerRow;
        const xOffset = citizenContainerX + (mafiaContainerWidth - (iconsPerRow * citizenIconWidth + (iconsPerRow - 1) * iconGap)) / 2;
        const xPos = xOffset + col * (citizenIconWidth + iconGap);
        const yPos = citizenContainerY + row * (iconHeight + iconGap);
        ctx.drawImage(citizenIcon, xPos, yPos, citizenIconWidth, iconHeight);
    });

    if(doctorIcon) doctorPlayers.forEach((player, index) => {
        const citizenIdx = citizenPlayers.length + index;
        const row = Math.floor(citizenIdx / iconsPerRow);
        const col = citizenIdx % iconsPerRow;
        const xOffset = citizenContainerX + (mafiaContainerWidth - (iconsPerRow * citizenIconWidth + (iconsPerRow - 1) * iconGap)) / 2;
        const xPos = xOffset + col * (citizenIconWidth + iconGap);
        const yPos = citizenContainerY + row * (iconHeight + iconGap);
        ctx.drawImage(doctorIcon, xPos, yPos, citizenIconWidth, iconHeight);
    });

  } else if (type === "end") {
    let winBanner;
    if (winnerType === "mafia") winBanner = await loadImg(MAFIA_WIN_BANNER);
    else winBanner = await loadImg(CITIZEN_WIN_BANNER);
    
    if(winBanner) ctx.drawImage(winBanner, 0, 0, 626, 339);
    else { ctx.fillStyle = "#333"; ctx.fillRect(0, 0, 626, 339); }

    const avatarSize = 30, avatarGap = 9, iconsPerRow = 5;
    const mafiaContainerWidth = 194, mafiaContainerX = 88, mafiaContainerY = 150;
    const citizenContainerX = 345, citizenContainerY = 150;

    const mafiaPlayers = allPlayers.filter((p) => p.role === "mafia");
    const citizenAndDoctorPlayers = allPlayers.filter((p) => p.role === "citizen" || p.role === "doctor");
    
    const fallbackAvatar = await loadImg("https://cdn.discordapp.com/embed/avatars/0.png");

    const mafiaAvatars = await Promise.all(mafiaPlayers.map(p => loadImg(p.avatarURL).catch(e => fallbackAvatar)));
    const citizenAndDoctorAvatars = await Promise.all(citizenAndDoctorPlayers.map(p => loadImg(p.avatarURL).catch(e => fallbackAvatar)));

    mafiaAvatars.forEach((avatar, index) => {
      const row = Math.floor(index / iconsPerRow);
      const col = index % iconsPerRow;
      const xOffset = mafiaContainerX + (mafiaContainerWidth - (iconsPerRow * avatarSize + (iconsPerRow - 1) * avatarGap)) / 2;
      const xPos = xOffset + col * (avatarSize + avatarGap);
      const yPos = mafiaContainerY + row * (avatarSize + avatarGap);
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(xPos + avatarSize / 2, yPos + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar || fallbackAvatar, xPos, yPos, avatarSize, avatarSize);
      ctx.restore();
    });

    citizenAndDoctorAvatars.forEach((avatar, index) => {
      const row = Math.floor(index / iconsPerRow);
      const col = index % iconsPerRow;
      const xOffset = citizenContainerX + (mafiaContainerWidth - (iconsPerRow * avatarSize + (iconsPerRow - 1) * avatarGap)) / 2;
      const xPos = xOffset + col * (avatarSize + avatarGap);
      const yPos = citizenContainerY + row * (avatarSize + avatarGap);
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(xPos + avatarSize / 2, yPos + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar || fallbackAvatar, xPos, yPos, avatarSize, avatarSize);
      ctx.restore();
    });
  }
  
  const buffer = canvas.toBuffer("image/png");
  return new AttachmentBuilder(buffer, { name: "mafia-game.png" });
}
