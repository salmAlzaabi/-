require('dotenv').config();
const path = require('path');
const fs = require('fs');

// ===== Arabic font registration =====
try {
  const { registerFont } = require("canvas");
  registerFont(path.join(__dirname, "img", "fonts", "Cairo-Bold.ttf"), { family: "NotoArabic" });
  console.log("[Canvas] Arabic font loaded.");
} catch (e) {
  console.warn("[Canvas] Arabic font not loaded:", e.message);
}
try {
  const napiCanvas = require("@napi-rs/canvas");
  napiCanvas.GlobalFonts.registerFromPath(path.join(__dirname, "img", "fonts", "Cairo-Bold.ttf"), "NotoArabic");
  console.log("[Napi Canvas] Arabic font loaded.");
} catch (e) {
  console.warn("[Napi Canvas] Arabic font not loaded:", e.message);
}

// ===== Express keep-alive =====
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello Express app!'));
app.listen(process.env.PORT || 3000, () => console.log('bot by wick studio/q3yb ( darkAngel ) ©2025 all rights reserved'));

// ===== Discord client =====
const {
  Client,
  GatewayIntentBits,
  Collection,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const db = require('./database.js');
const settings = require('./settings.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
client.games = new Collection();
client.cooldowns = new Collection();

// ===== Config / settings helpers =====
const ADMIN_SETTINGS_PATH = path.join(__dirname, 'admin_settings.json');
const GROUP_GAMES_PATH = path.join(__dirname, 'groupgames.txt');

let adminSettingsCache = null;
let adminSettingsCacheTime = 0;
const ADMIN_CACHE_TTL = 5000; // ms

const getAdminSettings = () => {
  const now = Date.now();
  if (adminSettingsCache && (now - adminSettingsCacheTime) < ADMIN_CACHE_TTL) {
    return adminSettingsCache;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ADMIN_SETTINGS_PATH, 'utf8'));
    if (!raw.disabledCommands) raw.disabledCommands = {};
    if (!raw.eventRoles) raw.eventRoles = [];
    if (!raw.adminRoles) raw.adminRoles = [];
    if (!raw.prefix) raw.prefix = '-';
    adminSettingsCache = raw;
    adminSettingsCacheTime = now;
    return raw;
  } catch {
    adminSettingsCache = { disabledCommands: {}, eventRoles: [], adminRoles: [], prefix: '-' };
    adminSettingsCacheTime = now;
    return adminSettingsCache;
  }
};

const getPrefix = () => getAdminSettings().prefix || '-';

const loadGroupGames = () => {
  try {
    const data = fs.readFileSync(GROUP_GAMES_PATH, 'utf8');
    const gameNames = data.split('\n').map(f => f.trim()).filter(Boolean).map(f => f.replace('.js', ''));
    console.log('[Game Loader] Loaded group games:', gameNames);
    return new Set(gameNames);
  } catch {
    console.warn('⚠️ | groupgames.txt not found.');
    return new Set();
  }
};
const groupGames = loadGroupGames();

const activeGames = new Map();

// ===== Load commands =====
const commandsDir = path.join(__dirname, 'commands');
if (fs.existsSync(commandsDir)) {
  for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    try {
      const command = require(path.join(commandsDir, file));
      if (!command?.name || typeof command.execute !== 'function') {
        console.warn(`[Command Loader] Skipping invalid command file: ${file}`);
        continue;
      }
      client.commands.set(command.name, command);
    } catch (e) {
      console.error(`[Command Loader] Failed to load ${file}:`, e.message);
    }
  }
}

// ===== Load games =====
const gamesDir = path.join(__dirname, 'games');
if (fs.existsSync(gamesDir)) {
  for (const file of fs.readdirSync(gamesDir).filter(f => f.endsWith('.js'))) {
    try {
      const game = require(path.join(gamesDir, file));
      if (!game?.name || typeof game.execute !== 'function') {
        console.warn(`[Game Loader] Skipping invalid game file: ${file}`);
        continue;
      }
      client.games.set(game.name, game);
    } catch (e) {
      console.error(`[Game Loader] Failed to load ${file}:`, e.message);
    }
  }
}

// ===== Ready =====
client.on('ready', () => {
  console.log(`✅ ${client.user.username} is Online`);
  console.log(`📦 Loaded ${client.commands.size} commands, ${client.games.size} games`);
  client.user.setActivity('emma moment', { type: 0 });
});

// ===== Message handler =====
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = getPrefix();
  const isCommand = message.content.startsWith(prefix);
  const isAllowedChannel = settings.isChannelAllowed(message.channel.id);

  if (!isCommand && !isAllowedChannel) return;

  if (!isCommand) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  if (!commandName) return;

  // ----- Regular commands -----
  const command = client.commands.get(commandName)
    || client.commands.find(cmd => cmd.aliases?.includes(commandName));

  if (command) {
    // Cooldown handling
    const cooldownAmount = (command.cooldown ?? 3) * 1000;
    if (cooldownAmount > 0) {
      if (!client.cooldowns.has(command.name)) {
        client.cooldowns.set(command.name, new Collection());
      }
      const timestamps = client.cooldowns.get(command.name);
      const now = Date.now();
      const expiresAt = timestamps.get(message.author.id);

      if (expiresAt && now < expiresAt) {
        const remaining = ((expiresAt - now) / 1000).toFixed(1);
        return message.reply(`⏳ | يرجى الانتظار **${remaining} ثانية** قبل استخدام هذا الأمر مرة أخرى.`).catch(() => {});
      }
      timestamps.set(message.author.id, now + cooldownAmount);
      setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
    }

    try {
      await command.execute(message, args, client);
    } catch (error) {
      console.error(`[Command Error] ${commandName}:`, error);
      message.reply('❌ | حدث خطأ أثناء محاولة تنفيذ هذا الأمر!').catch(() => {});
    }
    return;
  }

  // ----- Games -----
  if (!isAllowedChannel) return;

  const game = client.games.get(commandName)
    || client.games.find(gm => gm.aliases?.includes(commandName));

  if (!game) return;

  const adminSettingsData = getAdminSettings();
  if (adminSettingsData.disabledCommands?.[message.channel.id]?.includes(game.name)) {
    return message.channel.send(`❌ | لعبة **${game.name}** معطلة في هذه القناة.`).catch(() => {});
  }

  const gameKey = `${game.name}-${message.channel.id}`;
  if (game.name !== 'cut' && activeGames.has(gameKey)) {
    return message.channel.send(`⚠️ | هناك لعبة **${game.name}** نشطة بالفعل في هذه القناة. انتظر حتى تنتهي.`).catch(() => {});
  }

  activeGames.set(gameKey, true);

  const releaseLock = () => {
    activeGames.delete(gameKey);
  };

  try {
    if (groupGames.has(game.name)) {
      await game.execute(message, args, () => {
        releaseLock();
        console.log(`[Game Lock] Released for group game: ${game.name}`);
      });
    } else {
      await game.execute(message, args, async (userId, isCorrect, timeTaken, correctAnswer) => {
        releaseLock();

        if (isCorrect) {
          db.addPoints(userId, 1);
          const points = db.getUserPoints(userId);

          const pointsButton = new ButtonBuilder()
            .setCustomId(`points_button_${userId}`)
            .setLabel(String(points))
            .setEmoji('<:99AA_Primogem:1003301460739629187>')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const row = new ActionRowBuilder().addComponents(pointsButton);

          await message.channel.send({
            content: `<@${userId}> أجاب بشكل صحيح خلال **${timeTaken.toFixed(2)} ثانية!** (+1 نقطة)`,
            components: [row]
          }).catch(() => {});
        } else if (correctAnswer) {
          await message.channel.send(`🕒 | انتهى الوقت، لم يجب أحد على السؤال.\n✅ الجواب الصحيح كان: **${correctAnswer}**`).catch(() => {});
        } else {
          console.log(`[Game] ${game.name} ended with no answer.`);
        }
      });
    }
  } catch (error) {
    releaseLock();
    console.error(`[Game Error] ${game.name}:`, error);
    message.reply('❌ | حدث خطأ أثناء تشغيل هذه اللعبة!').catch(() => {});
  }
});

// ============================================================
// Points Panel
// ============================================================
const POINTS_COLOR = '#d4be78';
const POINTS_ROLE = '1501984311115776131';

const hasPointsPermission = (member) => {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.has(POINTS_ROLE);
};

const errorEmbed = (desc) => new EmbedBuilder().setColor('#ff4444').setDescription(desc);

// ============================================================
// Role Creator config
// ============================================================
const ROLE_ABOVE = '1501984358884708465';
const ROLE_BELOW = '1515471434003124278';

// ============================================================
// Unified interactionCreate handler
// ============================================================
client.on('interactionCreate', async (interaction) => {
  try {
    // ---------- Buttons ----------
    if (interaction.isButton()) {
      switch (interaction.customId) {

        case 'pts_view': {
          const points = db.getUserPoints(interaction.user.id);
          const top = db.getTopUsers(100);
          const rank = top.findIndex(([id]) => id === interaction.user.id) + 1;

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`🎮 | ${interaction.user.username}'s Points`)
                .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png' }))
                .addFields(
                  { name: '💰 Points', value: `**${points}** pts`, inline: true },
                  { name: '🏅 Rank', value: rank ? `**#${rank}**` : '—', inline: true },
                )
                .setColor(POINTS_COLOR)
                .setTimestamp()
            ],
            ephemeral: true
          });
        }

        case 'pts_give': {
          const modal = new ModalBuilder()
            .setCustomId('pts_give_modal')
            .setTitle('Transfer Points');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('pts_user_id')
                .setLabel('Recipient User ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter user ID...')
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('pts_amount')
                .setLabel('Amount to Transfer')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter amount...')
                .setRequired(true)
            )
          );

          return interaction.showModal(modal);
        }

        case 'pts_top': {
          const top = db.getTopUsers(10);
          if (!top.length) {
            return interaction.reply({ embeds: [errorEmbed('❌ | No points recorded yet.')], ephemeral: true });
          }

          const medals = ['🥇', '🥈', '🥉'];
          const desc = top.map(([userId, pts], i) => {
            const medal = medals[i] || `**${i + 1}.**`;
            return `${medal} <@${userId}> — **${pts}** pts`;
          }).join('\n');

          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('🏆 | Leaderboard')
                .setDescription(desc)
                .setColor(POINTS_COLOR)
                .setFooter({ text: 'Top 10 players by points' })
                .setTimestamp()
            ],
            ephemeral: true
          });
        }

        case 'create_role_btn': {
          if (!hasPointsPermission(interaction.member) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ embeds: [errorEmbed('❌ | No permission.')], ephemeral: true });
          }

          const modal = new ModalBuilder()
            .setCustomId('create_role_modal')
            .setTitle('Create New Role');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('role_name')
                .setLabel('Role Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter role name...')
                .setMinLength(1)
                .setMaxLength(100)
                .setRequired(true)
            )
          );

          return interaction.showModal(modal);
        }

        default:
          break;
      }
    }

    // ---------- Modals ----------
    if (interaction.isModalSubmit()) {

      // ----- Points transfer -----
      if (interaction.customId === 'pts_give_modal') {
        const userId = interaction.fields.getTextInputValue('pts_user_id').trim();
        const amount = parseInt(interaction.fields.getTextInputValue('pts_amount').trim(), 10);

        if (!/^\d{15,21}$/.test(userId)) {
          return interaction.reply({ embeds: [errorEmbed('❌ | Invalid user ID format.')], ephemeral: true });
        }
        if (isNaN(amount) || amount <= 0) {
          return interaction.reply({ embeds: [errorEmbed('❌ | Invalid amount.')], ephemeral: true });
        }
        if (userId === interaction.user.id) {
          return interaction.reply({ embeds: [errorEmbed('❌ | You cannot transfer points to yourself.')], ephemeral: true });
        }

        let targetUser;
        try {
          targetUser = await client.users.fetch(userId);
        } catch {
          return interaction.reply({ embeds: [errorEmbed('❌ | User not found.')], ephemeral: true });
        }

        if (targetUser.bot) {
          return interaction.reply({ embeds: [errorEmbed('❌ | You cannot transfer points to a bot.')], ephemeral: true });
        }

        const senderBalance = db.getUserPoints(interaction.user.id);
        if (senderBalance < amount) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ | Insufficient Balance')
                .addFields(
                  { name: '💰 Your Balance', value: `**${senderBalance}** pts`, inline: true },
                  { name: '💸 Requested', value: `**${amount}** pts`, inline: true },
                  { name: '❗ Missing', value: `**${amount - senderBalance}** pts`, inline: true },
                )
            ],
            ephemeral: true
          });
        }

        db.removePoints(interaction.user.id, amount);
        db.addPoints(targetUser.id, amount);

        const senderNew = db.getUserPoints(interaction.user.id);
        const receiverNew = db.getUserPoints(targetUser.id);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(POINTS_COLOR)
              .setTitle('✅ | Transfer Complete')
              .addFields(
                { name: '👤 From', value: `<@${interaction.user.id}>`, inline: true },
                { name: '👤 To', value: `<@${targetUser.id}>`, inline: true },
                { name: '💸 Amount', value: `**${amount}** pts`, inline: true },
                { name: '💰 Your New Balance', value: `**${senderNew}** pts`, inline: true },
                { name: '💰 Their New Balance', value: `**${receiverNew}** pts`, inline: true },
              )
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      // ----- Role creation -----
      if (interaction.customId === 'create_role_modal') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ embeds: [errorEmbed('❌ | No permission.')], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const roleName = interaction.fields.getTextInputValue('role_name').trim();
        const guild = interaction.guild;

        const roleAbove = guild.roles.cache.get(ROLE_ABOVE);
        const roleBelow = guild.roles.cache.get(ROLE_BELOW);

        if (!roleAbove || !roleBelow) {
          return interaction.editReply({
            embeds: [errorEmbed('❌ | Boundary roles not found. Check the role IDs.')]
          });
        }

        const newRole = await guild.roles.create({
          name: roleName,
          color: 0x000000,
          reason: `Created by ${interaction.user.tag} via Role Creator`,
        });

        const targetPosition = roleAbove.position + 1;
        await guild.roles.setPositions([{ role: newRole.id, position: targetPosition }]);

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(POINTS_COLOR)
              .setTitle('✅ | Role Created')
              .addFields(
                { name: '🏷️ Role', value: `<@&${newRole.id}>`, inline: true },
                { name: '📋 Name', value: `\`${roleName}\``, inline: true },
                { name: '📍 Position', value: `Between <@&${roleBelow.id}> and <@&${roleAbove.id}>`, inline: false },
              )
              .setTimestamp()
          ]
        });
      }
    }
  } catch (err) {
    console.error('[Interaction Error]:', err);

    const reply = { embeds: [errorEmbed(`❌ | Error: ${err.message}`)], ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    } catch {}
  }
});

// ============================================================
// Global safety nets
// ============================================================
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

client.on('error', (err) => {
  console.error('[Client Error]:', err);
});

client.on('shardError', (err) => {
  console.error('[Shard Error]:', err);
});

// ============================================================
// Login
// ============================================================
client.login(process.env.TOKEN).catch((err) => {
  console.error('❌ Invalid Token:', err.message);
  process.exit(1);
});

module.exports = { client };
