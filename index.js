require('dotenv').config();

// تسجيل الخط العربي مرة واحدة للكل
try {
  const { registerFont } = require("canvas");
  const path = require("path");
  registerFont(
path.join(__dirname, "img", "Cairo-Bold.ttf"),
{ family: "NotoArabic" }
  );
  console.log("[Canvas] Arabic font loaded successfully.");
} catch (e) {
  console.warn("[Canvas] Arabic font not loaded:", e.message);
}

const express = require('express');
const app = express();
const { Client, GatewayIntentBits, Collection, AttachmentBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database.js');
const settings = require('./settings.js');

app.get('/', (req, res) => {
  res.send('Hello Express app!');
});

app.listen(3000, () => {
  console.log('bot by wick studio/q3yb ( darkAngel ) ©2025 all rights reserved');
});

const getPrefix = () => {
  try {
    const adminSettings = JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8'));
    return adminSettings.prefix || '-';
  } catch (err) {
    return '-';
  }
};
const activeGames = new Map();
const loadGroupGames = () => {
  try {
    const data = fs.readFileSync('./groupgames.txt', 'utf8');
    const filenames = data.split('\n').filter(Boolean);
    const gameNames = filenames.map(f => f.trim().replace('.js', ''));
    console.log('[Game Loader] Loaded group games:', gameNames);
    return new Set(gameNames);
  } catch (err) {
    console.warn('⚠️ | groupgames.txt not found. No group games will be loaded.');
    return new Set();
  }
};
const groupGames = loadGroupGames();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
const commandFolders = ['commands'];
const gameFolders = ['games'];

for (const folder of commandFolders) {
  const commandFiles = fs.readdirSync(`./${folder}`).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(`./${folder}/${file}`);
    client.commands.set(command.name, command);
  }
}

client.games = new Collection();
for (const folder of gameFolders) {
  const gameFiles = fs.readdirSync(`./${folder}`).filter(file => file.endsWith('.js'));
  for (const file of gameFiles) {
    const game = require(`./${folder}/${file}`);
    client.games.set(game.name, game);
  }
}

const readAdminSettings = () => {
  try {
    const data = fs.readFileSync('./admin_settings.json', 'utf8');
    const settings = JSON.parse(data);
    if (!settings.disabledCommands) settings.disabledCommands = {};
    if (!settings.eventRoles) settings.eventRoles = [];
    if (!settings.adminRoles) settings.adminRoles = [];
    return settings;
  } catch (err) {
    console.error('Error reading admin settings:', err);
    return { disabledCommands: {}, eventRoles: [], adminRoles: [] };
  }
};

const hasEventPermission = (member) => {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminSettings = readAdminSettings();
  return member.roles.cache.some(role => adminSettings.eventRoles.includes(role.id));
};

const hasAdminPermission = (member) => {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminSettings = readAdminSettings();
  return member.roles.cache.some(role => adminSettings.adminRoles.includes(role.id));
};

client.on("ready", () => {
  console.log(`${client.user.username} is Online`);
  client.user.setActivity(`emma moment`, { type: 0 });
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  const prefix = getPrefix();
  const isCommand = message.content.startsWith(prefix);
  const isAllowedChannel = settings.isChannelAllowed(message.channel.id);
  if (!isCommand && !isAllowedChannel) return;

  if (isCommand) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (command) {
      try {
        command.execute(message, args);
        return;
      } catch (error) {
        console.error(error);
        message.reply('حدث خطأ أثناء محاولة تنفيذ هذا الأمر!');
        return;
      }
    }

    const game = client.games.get(commandName) || client.games.find(gm => gm.aliases && gm.aliases.includes(commandName));

    if (game && isAllowedChannel) {
      try {
        let adminSettings = {};
        try {
          adminSettings = JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8'));
        } catch (err) {
          // console.error('Error reading admin settings:', err); // معطل
        }

        if (adminSettings.disabledCommands &&
          adminSettings.disabledCommands[message.channel.id] &&
          adminSettings.disabledCommands[message.channel.id].includes(game.name)) {
          message.channel.send(`❌ | لعبة ${game.name} معطلة في هذه القناة.`);
          return;
        }

        const gameKey = `${commandName}-${message.channel.id}`;
        if (game.name !== 'cut' && activeGames.has(gameKey)) {
          message.channel.send(`⚠️ | هناك لعبة ${commandName} نشطة بالفعل في هذه القناة. انتظر حتى تنتهي.`);
          return;
        }

        activeGames.set(gameKey, true);
        if (groupGames.has(game.name)) {
          game.execute(message, args, () => {
            activeGames.delete(gameKey);
            console.log(`[Game Lock] Released for group game: ${game.name}`);
          });

        } else {
          game.execute(message, args, (userId, isCorrect, timeTaken, correctAnswer) => {
            activeGames.delete(gameKey);
            if (isCorrect) {
              db.addPoints(userId, 1);
              const points = db.getUserPoints(userId);
              const pointsButton = new ButtonBuilder()
                  .setCustomId(`points_button_${userId}`)
                  .setLabel(String(points))
                  .setEmoji('<:99AA_Primogem:1003301460739629187>')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true);
              const row = new ActionRowBuilder()
                  .addComponents(pointsButton);
              message.channel.send({
                  content: `<@${userId}> أجاب بشكل صحيح خلال **${timeTaken.toFixed(2)} ثانية!**`,
                  components: [row]
              });

            } else {
              if (correctAnswer) {
                message.channel.send(`🕒 | انتهى الوقت، لم يجب أحد على السؤال.\n✅ الجواب الصحيح كان: **${correctAnswer}**`);
              } else {
                console.log(`[Game] ${game.name} ended with no answer.`);
              }
            }
          });
        }
        return;

      } catch (error) {
        const gameKey = `${commandName}-${message.channel.id}`;
        activeGames.delete(gameKey);
        console.error(`Error executing game ${game.name}:`, error);
        message.reply('حدث خطأ أثناء تشغيل هذه اللعبة!');
        return;
      }
    }
  }
});

client.login(process.env.TOKEN).catch(() => {
  console.log("Invalid Token");
});

module.exports = { client };
