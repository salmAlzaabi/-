require('dotenv').config();
const path = require('path');

// Arabic font registration
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

const express = require('express');
const app = express();
const { Client, GatewayIntentBits, Collection, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const db = require('./database.js');
const settings = require('./settings.js');

app.get('/', (req, res) => res.send('Hello Express app!'));
app.listen(3000, () => console.log('bot by wick studio/q3yb ( darkAngel ) ©2025 all rights reserved'));

const getPrefix = () => {
  try {
    return JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8')).prefix || '-';
  } catch { return '-'; }
};

const activeGames = new Map();

const loadGroupGames = () => {
  try {
    const data = fs.readFileSync('./groupgames.txt', 'utf8');
    const gameNames = data.split('\n').filter(Boolean).map(f => f.trim().replace('.js', ''));
    console.log('[Game Loader] Loaded group games:', gameNames);
    return new Set(gameNames);
  } catch {
    console.warn('⚠️ | groupgames.txt not found.');
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
client.games = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

const gameFiles = fs.readdirSync('./games').filter(f => f.endsWith('.js'));
for (const file of gameFiles) {
  const game = require(`./games/${file}`);
  client.games.set(game.name, game);
}

const readAdminSettings = () => {
  try {
    const s = JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8'));
    if (!s.disabledCommands) s.disabledCommands = {};
    if (!s.eventRoles) s.eventRoles = [];
    if (!s.adminRoles) s.adminRoles = [];
    return s;
  } catch { return { disabledCommands: {}, eventRoles: [], adminRoles: [] }; }
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
      try { command.execute(message, args); return; }
      catch (error) {
        console.error(error);
        message.reply('حدث خطأ أثناء محاولة تنفيذ هذا الأمر!');
        return;
      }
    }

    const game = client.games.get(commandName) || client.games.find(gm => gm.aliases && gm.aliases.includes(commandName));

    if (game && isAllowedChannel) {
      try {
        let adminSettings = {};
        try { adminSettings = JSON.parse(fs.readFileSync('./admin_settings.json', 'utf8')); } catch {}

        if (adminSettings.disabledCommands?.[message.channel.id]?.includes(game.name)) {
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
              const row = new ActionRowBuilder().addComponents(pointsButton);
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

// ===== Points Panel Interactions =====
const POINTS_COLOR = "#d4be78";
const POINTS_ROLE = "1501984311115776131";

const hasPointsPermission = (member) => {
  if (member.permissions.has(8n)) return true;
  return member.roles.cache.has(POINTS_ROLE);
};

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {

      if (interaction.customId === 'pts_view') {
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
              .setColor('#000000')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'pts_give') {
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

      if (interaction.customId === 'pts_top') {
        const top = db.getTopUsers(10);
        if (!top.length) {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | No points recorded yet.')], ephemeral: true });
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
              .setColor('#000000')
              .setFooter({ text: 'Top 10 players by points' })
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'pts_give_modal') {
        const userId = interaction.fields.getTextInputValue('pts_user_id').trim();
        const amount = parseInt(interaction.fields.getTextInputValue('pts_amount').trim());

        if (isNaN(amount) || amount <= 0) {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | Invalid amount.')], ephemeral: true });
        }
        if (userId === interaction.user.id) {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | You cannot transfer points to yourself.')], ephemeral: true });
        }

        let targetUser;
        try {
          targetUser = await client.users.fetch(userId);
        } catch {
          return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | User not found.')], ephemeral: true });
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
              .setColor('#000000')
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
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
});

client.login(process.env.TOKEN).catch(() => console.log("Invalid Token"));
module.exports = { client };

// ===== Role Creator Interactions =====
const ROLE_ABOVE = "1501984358884708465";
const ROLE_BELOW = "1515471434003124278";

client.on('interactionCreate', async (roleInteraction) => {
  try {

    // Button - open modal
    if (roleInteraction.isButton() && roleInteraction.customId === 'create_role_btn') {
      if (!roleInteraction.member.permissions.has(8n)) {
        return roleInteraction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | No permission.')], ephemeral: true });
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

      return roleInteraction.showModal(modal);
    }

    // Modal submit - create the role
    if (roleInteraction.isModalSubmit() && roleInteraction.customId === 'create_role_modal') {
      if (!roleInteraction.member.permissions.has(8n)) {
        return roleInteraction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | No permission.')], ephemeral: true });
      }

      await roleInteraction.deferReply({ ephemeral: true });

      const roleName = roleInteraction.fields.getTextInputValue('role_name').trim();
      const guild = roleInteraction.guild;

      // Get the two boundary roles
      const roleAbove = guild.roles.cache.get(ROLE_ABOVE);
      const roleBelow = guild.roles.cache.get(ROLE_BELOW);

      if (!roleAbove || !roleBelow) {
        return roleInteraction.editReply({
          embeds: [new EmbedBuilder().setColor('#ff4444').setDescription('❌ | Boundary roles not found. Check the role IDs.')]
        });
      }

      // Create the role
      const newRole = await guild.roles.create({
        name: roleName,
        color: 0x000000,
        reason: `Created by ${roleInteraction.user.tag} via Role Creator`,
      });

      // Position it right above ROLE_ABOVE (between the two roles)
      // roleBelow is higher position, roleAbove is lower position
      const targetPosition = roleAbove.position + 1;

      await guild.roles.setPositions([
        { role: newRole.id, position: targetPosition }
      ]);

      return roleInteraction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#000000')
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

  } catch (err) {
    console.error('Role Creator error:', err);
    try {
      await roleInteraction.reply({ embeds: [new EmbedBuilder().setColor('#ff4444').setDescription(`❌ | Error: ${err.message}`)], ephemeral: true });
    } catch {}
  }
});
