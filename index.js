// ============================================================
//  CombatMC Discord Bot — index.js
//  Sunucu: mc.combatmc.net | BoxPvP 1.16.5
//  Özellikler:
//    ✅ Canlı Durum Embed (5 dk'da bir güncellenir)
//    ✅ Sesli Kanal Sayıcıları
//    ✅ /oyuncu komutu
//    ✅ Ticket Sistemi (kategorili buton)
//    ✅ /ekle /çıkar komutları
//    ✅ Transkript (HTML)
//    ✅ Otomatik Ticket Kapatma (24 saat)
//    ✅ Gelişmiş Log Sistemi
//    ✅ Küfür / Reklam Engelleyici
// ============================================================

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  AuditLogEvent,
} = require("discord.js");
const Gamedig = require("gamedig");

// ─── AYARLAR ────────────────────────────────────────────────
const CONFIG = {
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  mc: {
    host: "mc.combatmc.net",
    port: 25565,
    type: "minecraft",
  },

  channels: {
    // Bu kanal ID'lerini kendi sunucunuza göre doldurun
    statusEmbed: "STATUS_EMBED_CHANNEL_ID",
    ticketCategory: "TICKET_CATEGORY_ID",
    ticketLog: "TICKET_LOG_CHANNEL_ID",
    modLog: "MOD_LOG_CHANNEL_ID",
    messageLog: "MESSAGE_LOG_CHANNEL_ID",
    voiceLog: "VOICE_LOG_CHANNEL_ID",
  },

  voiceCounters: {
    playerCounter: "PLAYER_COUNTER_VC_ID",   // Örn: "🎮 Oyuncular: 0"
    memberCounter: "MEMBER_COUNTER_VC_ID",   // Örn: "👥 Üyeler: 0"
  },

  roles: {
    admin: "ADMIN_ROLE_ID",
    mod: "MOD_ROLE_ID",
    support: "SUPPORT_ROLE_ID",
  },

  autoCloseHours: 24,
};

// Yasaklı kelimeler
const BANNED_WORDS = ["küfür1", "küfür2", "küfür3"]; // gerçek küfürleri buraya ekle
const AD_PATTERNS = [/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, /play\.\w+\.net/, /mc\.\w+\.net/];
const AD_WHITELIST = ["mc.combatmc.net"]; // kendi sunucu adresiniz engellenmez

// ─── CLIENT ─────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Ticket takibi: Map<channelId, { ownerId, lastActivity, autoCloseTimer }>
const ticketData = new Map();
// Durum embed mesajı ID
let statusMessageId = null;

// ─── SLASH KOMUTLARI KAYDI ───────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName("oyuncu")
    .setDescription("BoxPvP oyuncu istatistiklerini gösterir")
    .addStringOption((o) =>
      o.setName("isim").setDescription("Oyuncu adı").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("ekle")
    .setDescription("Ticket kanalına kullanıcı ekler")
    .addUserOption((o) =>
      o.setName("kullanıcı").setDescription("Eklenecek kişi").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("çıkar")
    .setDescription("Ticket kanalından kullanıcı çıkarır")
    .addUserOption((o) =>
      o.setName("kullanıcı").setDescription("Çıkarılacak kişi").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("setup-durum")
    .setDescription("Canlı sunucu durum embedini bu kanala kurar")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("Ticket panelini bu kanala kurar")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(CONFIG.token);
  try {
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.clientId, CONFIG.guildId),
      { body: commands }
    );
    console.log("✅ Slash komutları kaydedildi.");
  } catch (e) {
    console.error("Komut kaydı hatası:", e);
  }
}

// ─── MC SUNUCU SORGULAMA ─────────────────────────────────────
async function queryServer() {
  try {
    const state = await Gamedig.query({
      type: CONFIG.mc.type,
      host: CONFIG.mc.host,
      port: CONFIG.mc.port,
    });
    return {
      online: true,
      players: state.players.length,
      maxPlayers: state.maxplayers,
      ping: state.ping,
      motd: state.name,
    };
  } catch {
    return { online: false, players: 0, maxPlayers: 0, ping: 999, motd: "" };
  }
}

// ─── DURUM EMBEDİ ────────────────────────────────────────────
async function buildStatusEmbed(info) {
  return new EmbedBuilder()
    .setTitle("⚔️ CombatMC — Sunucu Durumu")
    .setColor(info.online ? 0x2ecc71 : 0xe74c3c)
    .setThumbnail("https://api.mcstatus.io/v2/icon/mc.combatmc.net")
    .addFields(
      {
        name: "🌐 IP",
        value: "`mc.combatmc.net`",
        inline: true,
      },
      {
        name: "📡 Durum",
        value: info.online ? "🟢 Çevrimiçi" : "🔴 Çevrimdışı",
        inline: true,
      },
      {
        name: "👥 Oyuncular",
        value: info.online ? `${info.players} / ${info.maxPlayers}` : "—",
        inline: true,
      },
      {
        name: "📶 Ping",
        value: info.online ? `${info.ping} ms` : "—",
        inline: true,
      },
      {
        name: "🎮 Tür",
        value: "BoxPvP",
        inline: true,
      },
      {
        name: "🔧 Sürüm",
        value: "1.16.5",
        inline: true,
      }
    )
    .setFooter({ text: "Her 5 dakikada güncellenir" })
    .setTimestamp();
}

async function updateStatusEmbed() {
  try {
    const guild = client.guilds.cache.get(CONFIG.guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(CONFIG.channels.statusEmbed);
    if (!channel) return;

    const info = await queryServer();
    const embed = await buildStatusEmbed(info);

    if (statusMessageId) {
      try {
        const msg = await channel.messages.fetch(statusMessageId);
        await msg.edit({ embeds: [embed] });
      } catch {
        const msg = await channel.send({ embeds: [embed] });
        statusMessageId = msg.id;
      }
    } else {
      const msg = await channel.send({ embeds: [embed] });
      statusMessageId = msg.id;
    }

    // Sesli kanal sayıcılarını güncelle
    const playerVC = guild.channels.cache.get(CONFIG.voiceCounters.playerCounter);
    const memberVC = guild.channels.cache.get(CONFIG.voiceCounters.memberCounter);
    if (playerVC) await playerVC.setName(`🎮 Oyuncular: ${info.players}`).catch(() => {});
    if (memberVC) await memberVC.setName(`👥 Üyeler: ${guild.memberCount}`).catch(() => {});
  } catch (e) {
    console.error("Durum embed güncelleme hatası:", e);
  }
}

// ─── TİCKET SİSTEMİ ─────────────────────────────────────────
function ticketPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🎫 Destek Sistemi")
    .setDescription(
      "Aşağıdaki butonlardan birine tıklayarak destek talebi oluşturabilirsiniz.\n\n" +
      "🟢 **Destek** — Genel yardım\n" +
      "🟡 **Ödeme Sorunu** — Satın alma / ödeme\n" +
      "🔴 **Hile Bildirimi** — Hile kullanan oyuncu bildir"
    )
    .setColor(0x3498db)
    .setFooter({ text: "CombatMC Destek" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_destek")
      .setLabel("Destek")
      .setEmoji("🟢")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_odeme")
      .setLabel("Ödeme Sorunu")
      .setEmoji("🟡")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_hile")
      .setLabel("Hile Bildirimi")
      .setEmoji("🔴")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

async function createTicket(interaction, category) {
  const guild = interaction.guild;
  const user = interaction.user;

  // Zaten açık ticket var mı?
  const existing = guild.channels.cache.find(
    (c) => c.name === `ticket-${user.username.toLowerCase().replace(/\s/g, "-")}` &&
      c.parentId === CONFIG.channels.ticketCategory
  );
  if (existing) {
    return interaction.reply({
      content: `❌ Zaten açık bir ticketın var: ${existing}`,
      ephemeral: true,
    });
  }

  const categoryLabels = {
    ticket_destek: "Destek",
    ticket_odeme: "Ödeme Sorunu",
    ticket_hile: "Hile Bildirimi",
  };

  const channel = await guild.channels.create({
    name: `ticket-${user.username.toLowerCase().replace(/\s/g, "-")}`,
    type: ChannelType.GuildText,
    parent: CONFIG.channels.ticketCategory,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: CONFIG.roles.support, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: CONFIG.roles.mod, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${categoryLabels[category]} Talebi`)
    .setDescription(
      `Merhaba ${user}, ticketın oluşturuldu!\n\n` +
      `**Kategori:** ${categoryLabels[category]}\n` +
      `Sorununuzu detaylıca açıklayın, en kısa sürede yardımcı olunacak.`
    )
    .setColor(0x2ecc71)
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_kapat")
      .setLabel("Ticketı Kapat")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: `${user} <@&${CONFIG.roles.support}>`, embeds: [embed], components: [closeRow] });
  await interaction.reply({ content: `✅ Ticketın oluşturuldu: ${channel}`, ephemeral: true });

  // Otomatik kapatma zamanlayıcısı
  const timer = setTimeout(() => autoCloseTicket(channel, user), CONFIG.autoCloseHours * 60 * 60 * 1000);
  ticketData.set(channel.id, { ownerId: user.id, lastActivity: Date.now(), timer });
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  const data = ticketData.get(channel.id);

  await interaction.reply({ content: "🔒 Ticket kapatılıyor, transkript oluşturuluyor..." });

  await generateTranscript(channel, data?.ownerId);

  if (data?.timer) clearTimeout(data.timer);
  ticketData.delete(channel.id);

  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

async function autoCloseTicket(channel, user) {
  if (!channel.guild.channels.cache.has(channel.id)) return;
  try {
    await channel.send("⏰ 24 saattir işlem yapılmadığı için bu ticket otomatik olarak kapatılıyor.");
    await generateTranscript(channel, user?.id);
    ticketData.delete(channel.id);
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  } catch {}
}

async function generateTranscript(channel, ownerId) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Ticket Transkript — #${channel.name}</title>
<style>
  body { background:#1a1a2e; color:#eee; font-family:sans-serif; padding:20px; }
  h1 { color:#e94560; }
  .msg { margin:10px 0; padding:10px; background:#16213e; border-radius:8px; }
  .author { font-weight:bold; color:#0f3460; }
  .time { font-size:0.8em; color:#aaa; }
  .content { margin-top:5px; }
</style>
</head>
<body>
<h1>📜 Ticket: #${channel.name}</h1>
<p>Kapatılma: ${new Date().toLocaleString("tr-TR")}</p>
<hr>
${sorted
  .map(
    (m) => `<div class="msg">
  <span class="author">${m.author.tag}</span>
  <span class="time"> — ${m.createdAt.toLocaleString("tr-TR")}</span>
  <div class="content">${m.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<em>[embed/dosya]</em>"}</div>
</div>`
  )
  .join("\n")}
</body>
</html>`;

    const { AttachmentBuilder } = require("discord.js");
    const buffer = Buffer.from(html, "utf-8");
    const attachment = new AttachmentBuilder(buffer, { name: `transkript-${channel.name}.html` });

    // Log kanalına gönder
    const logChannel = channel.guild.channels.cache.get(CONFIG.channels.ticketLog);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📋 Ticket Kapatıldı")
        .addFields(
          { name: "Kanal", value: `#${channel.name}`, inline: true },
          { name: "Kapanış", value: new Date().toLocaleString("tr-TR"), inline: true }
        )
        .setColor(0xe74c3c);
      await logChannel.send({ embeds: [logEmbed], files: [attachment] });
    }

    // Ticket sahibine DM
    if (ownerId) {
      const owner = await channel.guild.members.fetch(ownerId).catch(() => null);
      if (owner) {
        await owner.send({
          content: "📄 Ticket transkriptiniz:",
          files: [new AttachmentBuilder(buffer, { name: `transkript-${channel.name}.html` })],
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("Transkript hatası:", e);
  }
}

// ─── MOD LOG ────────────────────────────────────────────────
async function sendModLog(guild, embed) {
  const ch = guild.channels.cache.get(CONFIG.channels.modLog);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function sendMessageLog(guild, embed) {
  const ch = guild.channels.cache.get(CONFIG.channels.messageLog);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function sendVoiceLog(guild, embed) {
  const ch = guild.channels.cache.get(CONFIG.channels.voiceLog);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

// ─── KÜFÜR / REKLAM ENGELLEYİCİ ────────────────────────────
function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w));
}

function containsAd(text) {
  const lower = text.toLowerCase();
  if (AD_WHITELIST.some((w) => lower.includes(w))) return false;
  return AD_PATTERNS.some((p) => p.test(lower));
}

// ─── EVENTler ────────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} aktif!`);
  await registerCommands();
  await updateStatusEmbed();
  setInterval(updateStatusEmbed, 5 * 60 * 1000); // 5 dakika
});

// Mesaj Silme Logu
client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle("🗑️ Mesaj Silindi")
    .setColor(0xe74c3c)
    .addFields(
      { name: "Kullanıcı", value: `${message.author?.tag || "Bilinmiyor"} (${message.author?.id || "?"})`, inline: true },
      { name: "Kanal", value: `${message.channel}`, inline: true },
      { name: "İçerik", value: message.content?.slice(0, 1024) || "*(boş)*" }
    )
    .setTimestamp();
  await sendMessageLog(message.guild, embed);
});

// Mesaj Düzenleme Logu
client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setTitle("✏️ Mesaj Düzenlendi")
    .setColor(0xf39c12)
    .addFields(
      { name: "Kullanıcı", value: `${oldMsg.author?.tag} (${oldMsg.author?.id})`, inline: true },
      { name: "Kanal", value: `${oldMsg.channel}`, inline: true },
      { name: "Eski", value: oldMsg.content?.slice(0, 512) || "—" },
      { name: "Yeni", value: newMsg.content?.slice(0, 512) || "—" }
    )
    .setTimestamp();
  await sendMessageLog(oldMsg.guild, embed);
});

// Ses Kanalı Logu
client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild;
  const member = newState.member;
  let embed;

  if (!oldState.channelId && newState.channelId) {
    embed = new EmbedBuilder()
      .setTitle("🔊 Ses Kanalına Katıldı")
      .setColor(0x2ecc71)
      .addFields(
        { name: "Kullanıcı", value: `${member.user.tag}`, inline: true },
        { name: "Kanal", value: `${newState.channel?.name}`, inline: true }
      )
      .setTimestamp();
  } else if (oldState.channelId && !newState.channelId) {
    embed = new EmbedBuilder()
      .setTitle("🔇 Ses Kanalından Ayrıldı")
      .setColor(0xe74c3c)
      .addFields(
        { name: "Kullanıcı", value: `${member.user.tag}`, inline: true },
        { name: "Kanal", value: `${oldState.channel?.name}`, inline: true }
      )
      .setTimestamp();
  } else if (oldState.channelId !== newState.channelId) {
    embed = new EmbedBuilder()
      .setTitle("🔀 Ses Kanalı Değiştirdi")
      .setColor(0x3498db)
      .addFields(
        { name: "Kullanıcı", value: `${member.user.tag}`, inline: true },
        { name: "Önceki", value: `${oldState.channel?.name}`, inline: true },
        { name: "Yeni", value: `${newState.channel?.name}`, inline: true }
      )
      .setTimestamp();
  }

  if (embed) await sendVoiceLog(guild, embed);
});

// Ceza Logu (ban/kick)
client.on("guildBanAdd", async (ban) => {
  const embed = new EmbedBuilder()
    .setTitle("🔨 Kullanıcı Banlandı")
    .setColor(0xe74c3c)
    .addFields({ name: "Kullanıcı", value: `${ban.user.tag} (${ban.user.id})` })
    .setTimestamp();
  await sendModLog(ban.guild, embed);
});

client.on("guildBanRemove", async (ban) => {
  const embed = new EmbedBuilder()
    .setTitle("✅ Ban Kaldırıldı")
    .setColor(0x2ecc71)
    .addFields({ name: "Kullanıcı", value: `${ban.user.tag} (${ban.user.id})` })
    .setTimestamp();
  await sendModLog(ban.guild, embed);
});

// Mesaj içeriği kontrolü (küfür/reklam)
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Ticket aktivitesi güncelle (otomatik kapanmayı sıfırla)
  if (ticketData.has(message.channelId)) {
    const data = ticketData.get(message.channelId);
    clearTimeout(data.timer);
    data.lastActivity = Date.now();
    data.timer = setTimeout(
      () => autoCloseTicket(message.channel, { id: data.ownerId }),
      CONFIG.autoCloseHours * 60 * 60 * 1000
    );
    ticketData.set(message.channelId, data);
  }

  const content = message.content;
  const isAdmin =
    message.member?.permissions.has(PermissionFlagsBits.Administrator) || false;
  if (isAdmin) return;

  if (containsBannedWord(content)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(
      `⚠️ ${message.author}, uygunsuz dil kullanmak yasaktır! **Uyarı verildi.**`
    );
    setTimeout(() => warn.delete().catch(() => {}), 5000);

    const embed = new EmbedBuilder()
      .setTitle("🤬 Küfür Tespit Edildi")
      .setColor(0xe74c3c)
      .addFields(
        { name: "Kullanıcı", value: `${message.author.tag} (${message.author.id})` },
        { name: "Kanal", value: `${message.channel}` },
        { name: "İçerik", value: content.slice(0, 512) }
      )
      .setTimestamp();
    await sendModLog(message.guild, embed);
    return;
  }

  if (containsAd(content)) {
    await message.delete().catch(() => {});
    const warn = await message.channel.send(
      `🚫 ${message.author}, başka sunucu reklamı yapmak yasaktır!`
    );
    setTimeout(() => warn.delete().catch(() => {}), 5000);

    const embed = new EmbedBuilder()
      .setTitle("📢 Reklam Tespit Edildi")
      .setColor(0xe67e22)
      .addFields(
        { name: "Kullanıcı", value: `${message.author.tag} (${message.author.id})` },
        { name: "Kanal", value: `${message.channel}` },
        { name: "İçerik", value: content.slice(0, 512) }
      )
      .setTimestamp();
    await sendModLog(message.guild, embed);
  }
});

// ─── SLASH KOMUT İŞLEYİCİ ────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  // ── Slash Komutlar ──
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    // /setup-durum
    if (commandName === "setup-durum") {
      CONFIG.channels.statusEmbed = interaction.channelId;
      statusMessageId = null;
      await updateStatusEmbed();
      return interaction.reply({ content: "✅ Durum embed kuruldu!", ephemeral: true });
    }

    // /setup-ticket
    if (commandName === "setup-ticket") {
      await interaction.channel.send(ticketPanel());
      return interaction.reply({ content: "✅ Ticket paneli kuruldu!", ephemeral: true });
    }

    // /oyuncu
    if (commandName === "oyuncu") {
      const name = interaction.options.getString("isim");
      await interaction.deferReply();

      // NOT: Gerçek BoxPvP API entegrasyonu için kendi API'nizi kullanın.
      // Aşağıdaki veri şablondur; kendi veritabanınız veya API'niz ile değiştirin.
      const mockData = {
        rank: "Savaşçı",
        kills: 420,
        deaths: 69,
        activeSet: "Elmas Seti",
      };

      const kda = mockData.deaths > 0 ? (mockData.kills / mockData.deaths).toFixed(2) : "∞";

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${name} — BoxPvP İstatistikleri`)
        .setColor(0xe74c3c)
        .addFields(
          { name: "🏅 Rütbe", value: mockData.rank, inline: true },
          { name: "⚔️ Öldürme", value: `${mockData.kills}`, inline: true },
          { name: "💀 Ölme", value: `${mockData.deaths}`, inline: true },
          { name: "📊 KDA", value: `${kda}`, inline: true },
          { name: "🛡️ Aktif Set", value: mockData.activeSet, inline: true }
        )
        .setFooter({ text: "mc.combatmc.net" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // /ekle
    if (commandName === "ekle") {
      if (!ticketData.has(interaction.channelId)) {
        return interaction.reply({ content: "❌ Bu komut sadece ticket kanallarında kullanılabilir.", ephemeral: true });
      }
      const user = interaction.options.getUser("kullanıcı");
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
      });
      return interaction.reply({ content: `✅ ${user} bu ticket'a eklendi.` });
    }

    // /çıkar
    if (commandName === "çıkar") {
      if (!ticketData.has(interaction.channelId)) {
        return interaction.reply({ content: "❌ Bu komut sadece ticket kanallarında kullanılabilir.", ephemeral: true });
      }
      const user = interaction.options.getUser("kullanıcı");
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
        SendMessages: false,
      });
      return interaction.reply({ content: `✅ ${user} bu ticket'tan çıkarıldı.` });
    }
  }

  // ── Buton Etkileşimleri ──
  if (interaction.isButton()) {
    const { customId } = interaction;

    if (["ticket_destek", "ticket_odeme", "ticket_hile"].includes(customId)) {
      return createTicket(interaction, customId);
    }

    if (customId === "ticket_kapat") {
      const data = ticketData.get(interaction.channelId);
      const isMod =
        interaction.member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
        interaction.user.id === data?.ownerId;

      if (!isMod) {
        return interaction.reply({ content: "❌ Sadece moderatörler veya ticket sahibi kapatabilir.", ephemeral: true });
      }
      return closeTicket(interaction);
    }
  }
});

// ─── BAŞLAT ──────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
