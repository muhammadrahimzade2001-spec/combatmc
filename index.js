const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes,
  Collection,
} = require("discord.js");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const config = {
  token: "BOT_TOKEN_BURAYA",        // Discord bot tokenini buraya yaz
  clientId: "CLIENT_ID_BURAYA",     // Bot client ID
  guildId: "SUNUCU_ID_BURAYA",      // Sunucu ID
  prefix: "!",
  mcIp: "mc.combatmc.net",
  mcVersion: "1.16.5x",
  botName: "CombatMC",
  color: {
    main: 0xe84242,      // Kırmızı - CombatMC ana rengi
    success: 0x2ecc71,
    error: 0xe74c3c,
    warn: 0xf39c12,
    info: 0x3498db,
  },
  channels: {
    ticketCategory: "TİCKET_KATEGORİ_ID",   // Ticket kategorisi
    ticketLog: "TİCKET_LOG_KANAL_ID",         // Ticket log kanalı
    duyuru: "DUYURU_KANAL_ID",               // Duyuru kanalı
  },
  roles: {
    admin: "ADMİN_ROL_ID",
    mod: "MODERATOR_ROL_ID",
    support: "DESTEK_ROL_ID",
  },
  emoji: {
    sword: "⚔️",
    shield: "🛡️",
    ticket: "🎫",
    check: "✅",
    cross: "❌",
    warn: "⚠️",
    crown: "👑",
    info: "ℹ️",
    ban: "🔨",
    mute: "🔇",
    kick: "👢",
    star: "⭐",
    fire: "🔥",
    lock: "🔒",
    unlock: "🔓",
  },
};

// ─── CLIENT SETUP ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Ticket paneli mesaj ID'si (kalıcı tutmak için bir dosyaya da yazabilirsin)
const ticketPanelMessages = new Map();
const openTickets = new Map(); // userId -> channelId

// ─── YARDIMCI FONKSİYONLAR ────────────────────────────────────────────────────
function hasRole(member, roleId) {
  return member.roles.cache.has(roleId);
}

function isAdmin(member) {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    hasRole(member, config.roles.admin)
  );
}

function isMod(member) {
  return (
    isAdmin(member) ||
    hasRole(member, config.roles.mod) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers)
  );
}

function errorEmbed(desc) {
  return new EmbedBuilder()
    .setColor(config.color.error)
    .setDescription(`${config.emoji.cross} **${desc}**`)
    .setTimestamp();
}

function successEmbed(desc) {
  return new EmbedBuilder()
    .setColor(config.color.success)
    .setDescription(`${config.emoji.check} **${desc}**`)
    .setTimestamp();
}

function mainEmbed(title, desc) {
  return new EmbedBuilder()
    .setColor(config.color.main)
    .setTitle(`${config.emoji.sword} ${title}`)
    .setDescription(desc)
    .setFooter({ text: `CombatMC • ${config.mcIp}` })
    .setTimestamp();
}

// ─── TICKET SİSTEMİ ───────────────────────────────────────────────────────────

// Ticket panel embed + buton
function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setColor(config.color.main)
    .setTitle("🎫 CombatMC Destek Sistemi")
    .setDescription(
      [
        "```",
        "  ⚔️  CombatMC Destek Merkezi  ⚔️",
        "```",
        "",
        "**Aşağıdan uygun kategoriyi seçerek ticket açabilirsin.**",
        "",
        `${config.emoji.sword} **Sunucu IP:** \`${config.mcIp}\``,
        `${config.emoji.star} **Sürüm:** \`${config.mcVersion}\``,
        "",
        "> Gereksiz ticket açmak yasaktır.",
        "> Ticket açtıktan sonra sorununu detaylı anlat.",
        "> Ekip üyesi müsait olduğunda sana dönecek.",
      ].join("\n")
    )
    .setThumbnail(
      "https://i.imgur.com/8a5bZ3E.png"
    )
    .setFooter({ text: "CombatMC • Destek Ekibi", iconURL: "https://i.imgur.com/8a5bZ3E.png" })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket_category")
    .setPlaceholder("📂 Kategori seç...")
    .addOptions([
      {
        label: "⚔️ Hile Şikayeti",
        description: "Hile kullanan oyuncuyu şikayet et",
        value: "hile_sikayet",
        emoji: "⚔️",
      },
      {
        label: "🛡️ Yetkili Şikayeti",
        description: "Yetkili hakkında şikayette bulun",
        value: "yetkili_sikayet",
        emoji: "🛡️",
      },
      {
        label: "💰 Alışveriş Yardımı",
        description: "Mağaza / ödeme sorunları",
        value: "alisveris",
        emoji: "💰",
      },
      {
        label: "🔓 Ban / Mute İtiraz",
        description: "Ban veya mute itirazı yap",
        value: "itiraz",
        emoji: "🔓",
      },
      {
        label: "💡 Öneri / Geri Bildirim",
        description: "Sunucu hakkında öneri sun",
        value: "oneri",
        emoji: "💡",
      },
      {
        label: "❓ Diğer",
        description: "Diğer konular için destek al",
        value: "diger",
        emoji: "❓",
      },
    ]);

  const row = new ActionRowBuilder().addComponents(select);
  return { embeds: [embed], components: [row] };
}

// Ticket kanalı oluştur
async function createTicket(interaction, category) {
  const guild = interaction.guild;
  const user = interaction.user;

  if (openTickets.has(user.id)) {
    const existingChannel = guild.channels.cache.get(openTickets.get(user.id));
    if (existingChannel) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `Zaten açık bir ticketin var! ${existingChannel}`
          ),
        ],
        ephemeral: true,
      });
      return;
    }
  }

  const categoryLabels = {
    hile_sikayet: "Hile Şikayeti",
    yetkili_sikayet: "Yetkili Şikayeti",
    alisveris: "Alışveriş",
    itiraz: "İtiraz",
    oneri: "Öneri",
    diger: "Diğer",
  };

  const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString().slice(-4)}`;

  try {
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.channels.ticketCategory || null,
      topic: `${categoryLabels[category]} | ${user.tag} | ${user.id}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: config.roles.support || config.roles.admin,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ],
    });

    openTickets.set(user.id, ticketChannel.id);

    // Ticket içi embed
    const ticketEmbed = new EmbedBuilder()
      .setColor(config.color.main)
      .setTitle(`🎫 ${categoryLabels[category]} Ticketi`)
      .setDescription(
        [
          `Merhaba ${user}! Ticketin oluşturuldu.`,
          "",
          `**Kategori:** ${categoryLabels[category]}`,
          `**Açılan:** <t:${Math.floor(Date.now() / 1000)}:F>`,
          "",
          "> 📝 **Sorununu detaylı şekilde anlat.**",
          "> 📎 Gerekirse ekran görüntüsü ekle.",
          "> ⏳ Ekip üyesi en kısa sürede ilgilenecek.",
        ].join("\n")
      )
      .setFooter({ text: `CombatMC • ${config.mcIp}` })
      .setTimestamp();

    const closeBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("🔒 Ticketi Kapat")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("✋ Üstlen")
        .setStyle(ButtonStyle.Primary)
    );

    await ticketChannel.send({
      content: `${user} | <@&${config.roles.support || config.roles.admin}>`,
      embeds: [ticketEmbed],
      components: [closeBtn],
    });

    await interaction.reply({
      embeds: [
        successEmbed(`Ticketin açıldı! ${ticketChannel}`),
      ],
      ephemeral: true,
    });

    // Log
    const logChannel = guild.channels.cache.get(config.channels.ticketLog);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor(config.color.info)
        .setTitle("📂 Yeni Ticket Açıldı")
        .addFields(
          { name: "Kullanıcı", value: `${user.tag} (${user.id})`, inline: true },
          { name: "Kategori", value: categoryLabels[category], inline: true },
          { name: "Kanal", value: `${ticketChannel}`, inline: true }
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
  } catch (err) {
    console.error("Ticket oluşturma hatası:", err);
    await interaction.reply({
      embeds: [errorEmbed("Ticket oluşturulurken bir hata oluştu!")],
      ephemeral: true,
    });
  }
}

// Ticket kapat
async function closeTicket(interaction) {
  const channel = interaction.channel;
  const topic = channel.topic || "";

  // Kullanıcı ID'sini topic'ten al
  const userId = topic.split(" | ")[2];

  if (userId) openTickets.delete(userId);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(config.color.warn)
        .setDescription("🔒 **Ticket 5 saniye içinde kapatılacak...**"),
    ],
  });

  setTimeout(async () => {
    // Log
    const logChannel = interaction.guild.channels.cache.get(config.channels.ticketLog);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor(config.color.error)
        .setTitle("🔒 Ticket Kapatıldı")
        .addFields(
          { name: "Kanal", value: channel.name, inline: true },
          { name: "Kapatan", value: `${interaction.user.tag}`, inline: true }
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
    await channel.delete("Ticket kapatıldı").catch(() => {});
  }, 5000);
}

// ─── PREFIX KOMUTLAR ──────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const guild = message.guild;
  const member = message.member;

  // ── SUNUCU YÖNETİM ─────────────────────────────────────────────────────────

  // !aktif [not] — Sunucu açıldı duyurusu
  if (command === "aktif") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Bu komutu kullanma yetkin yok!")] });
    const not = args.join(" ") || "Sunucu aktif!";
    const duyuruKanal = guild.channels.cache.get(config.channels.duyuru) || message.channel;
    const embed = mainEmbed("🟢 Sunucu Açıldı!", not)
      .setColor(config.color.success)
      .addFields(
        { name: "IP", value: `\`${config.mcIp}\``, inline: true },
        { name: "Sürüm", value: `\`${config.mcVersion}\``, inline: true }
      );
    duyuruKanal.send({ content: "@everyone", embeds: [embed] });
    if (duyuruKanal.id !== message.channel.id)
      message.reply({ embeds: [successEmbed("Duyuru gönderildi!")] });
    return;
  }

  // !bakim [sure] — Bakım duyurusu
  if (command === "bakim") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Bu komutu kullanma yetkin yok!")] });
    const sure = args.join(" ") || "Belirtilmedi";
    const duyuruKanal = guild.channels.cache.get(config.channels.duyuru) || message.channel;
    const embed = mainEmbed("🔧 Bakım Modu", `Sunucu bakıma alındı.\n**Tahmini Süre:** ${sure}`)
      .setColor(config.color.warn);
    duyuruKanal.send({ content: "@everyone", embeds: [embed] });
    if (duyuruKanal.id !== message.channel.id)
      message.reply({ embeds: [successEmbed("Bakım duyurusu gönderildi!")] });
    return;
  }

  // !oyuncu-sayisi — Online oyuncu sayısı
  if (command === "oyuncu-sayisi") {
    const embed = mainEmbed(
      "👥 Oyuncu Sayısı",
      `**${config.mcIp}** sunucusunun anlık oyuncu bilgisi\n\n> Bu özellik için sunucu API entegrasyonu gerekir.`
    );
    return message.reply({ embeds: [embed] });
  }

  // ── ETKİNLİK & TOPLULUK ────────────────────────────────────────────────────

  // !oneri <mesaj> — Oylama ile öneri gönder
  if (command === "oneri") {
    if (!args.length)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!oneri <mesaj>`")] });
    const oneriMetni = args.join(" ");
    const embed = new EmbedBuilder()
      .setColor(config.color.info)
      .setTitle("💡 Yeni Öneri")
      .setDescription(oneriMetni)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTimestamp()
      .setFooter({ text: `CombatMC • ${config.mcIp}` });
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react("✅");
    await msg.react("❌");
    message.delete().catch(() => {});
    return;
  }

  // !cekilis-baslat <ödül> <süre> [kazanan] — Çekiliş başlat
  if (command === "cekilis-baslat") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const odul = args[0] || "Belirtilmedi";
    const sure = args[1] || "1s";
    const kazananSayisi = parseInt(args[2]) || 1;
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("🎉 ÇEKİLİŞ BAŞLADI!")
      .setDescription(
        [
          `**Ödül:** ${odul}`,
          `**Süre:** ${sure}`,
          `**Kazanan:** ${kazananSayisi} kişi`,
          "",
          "**🎊 ile tepki vererek katıl!**",
        ].join("\n")
      )
      .setFooter({ text: `Başlatan: ${message.author.tag}` })
      .setTimestamp();
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react("🎊");
    message.delete().catch(() => {});
    return;
  }

  // !hata-bildir <açıklama> [link] — Bug bildir
  if (command === "hata-bildir") {
    if (!args.length)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!hata-bildir <açıklama> [link]`")] });
    const aciklama = args.join(" ");
    const embed = new EmbedBuilder()
      .setColor(config.color.error)
      .setTitle("🐛 Bug Raporu")
      .setDescription(aciklama)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setTimestamp()
      .setFooter({ text: `CombatMC Bug Tracker • ${config.mcIp}` });
    message.channel.send({ embeds: [embed] });
    message.reply({ embeds: [successEmbed("Bug raporu gönderildi, teşekkürler!")] });
    return;
  }

  // ── MODERASYON ─────────────────────────────────────────────────────────────

  // !ban <@kullanıcı> [sebep]
  if (command === "ban") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!ban <@kullanıcı> [sebep]`")] });
    const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
    await target.ban({ reason: sebep }).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Ban atılamadı: ${e.message}`)] });
    });
    const embed = mainEmbed(
      "🔨 Ban Atıldı",
      `**Kullanıcı:** ${target.user.tag}\n**Sebep:** ${sebep}\n**Banlayan:** ${message.author.tag}`
    ).setColor(config.color.error);
    message.channel.send({ embeds: [embed] });
    return;
  }

  // !unban <userID> [sebep]
  if (command === "unban") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const userId = args[0];
    const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
    if (!userId)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!unban <userID> [sebep]`")] });
    await guild.members.unban(userId, sebep).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Unban yapılamadı: ${e.message}`)] });
    });
    message.reply({ embeds: [successEmbed(`**${userId}** bandan çıkarıldı. Sebep: ${sebep}`)] });
    return;
  }

  // !kick <@kullanıcı> [sebep]
  if (command === "kick") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!kick <@kullanıcı> [sebep]`")] });
    const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
    await target.kick(sebep).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Kick atılamadı: ${e.message}`)] });
    });
    const embed = mainEmbed(
      "👢 Kick Atıldı",
      `**Kullanıcı:** ${target.user.tag}\n**Sebep:** ${sebep}\n**Kickleyen:** ${message.author.tag}`
    ).setColor(config.color.warn);
    message.channel.send({ embeds: [embed] });
    return;
  }

  // !mute <@kullanıcı> <sure> [sebep]
  if (command === "mute") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!mute <@kullanıcı> <sure> [sebep]`")] });
    const sureStr = args[1] || "10m";
    const sebep = args.slice(2).join(" ") || "Sebep belirtilmedi";
    // Süreyi ms'e çevir
    const timeMap = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const timeUnit = sureStr.slice(-1);
    const timeVal = parseInt(sureStr) || 10;
    const durationMs = (timeMap[timeUnit] || 60000) * timeVal;
    await target.timeout(durationMs, sebep).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Mute yapılamadı: ${e.message}`)] });
    });
    const embed = mainEmbed(
      "🔇 Mute Yapıldı",
      `**Kullanıcı:** ${target.user.tag}\n**Süre:** ${sureStr}\n**Sebep:** ${sebep}\n**Yapan:** ${message.author.tag}`
    ).setColor(config.color.warn);
    message.channel.send({ embeds: [embed] });
    return;
  }

  // !unmute <@kullanıcı>
  if (command === "unmute") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!unmute <@kullanıcı>`")] });
    await target.timeout(null).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Unmute yapılamadı: ${e.message}`)] });
    });
    message.reply({ embeds: [successEmbed(`${target.user.tag} mutedan çıkarıldı.`)] });
    return;
  }

  // !warn <@kullanıcı>
  if (command === "warn") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!warn <@kullanıcı>`")] });
    const sebep = args.slice(1).join(" ") || "Sebep belirtilmedi";
    const embed = mainEmbed(
      "⚠️ Uyarı",
      `${target} kullanıcısına uyarı verildi.\n**Sebep:** ${sebep}\n**Veren:** ${message.author.tag}`
    ).setColor(config.color.warn);
    message.channel.send({ embeds: [embed] });
    // DM
    target.send({ embeds: [embed] }).catch(() => {});
    return;
  }

  // !waro / !warn-o / !delwarn / !clearwarn
  if (["waro", "warn-o", "delwarn", "clearwarn"].includes(command)) {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!waro <@kullanıcı>`")] });
    message.reply({ embeds: [successEmbed(`${target.user.tag} kullanıcısının uyarıları temizlendi.`)] });
    return;
  }

  // !karaliste <@kullanıcı> <sebep> [kanıt]
  if (command === "karaliste") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!karaliste <@kullanıcı> <sebep> [kanıt]`")] });
    const sebep = args[1] || "Belirtilmedi";
    const kanit = args.slice(2).join(" ") || "Yok";
    const embed = mainEmbed(
      "⛔ Karaliste",
      `**Kullanıcı:** ${target.user.tag} (${target.id})\n**Sebep:** ${sebep}\n**Kanıt:** ${kanit}\n**Ekleyen:** ${message.author.tag}`
    ).setColor(config.color.error);
    message.channel.send({ embeds: [embed] });
    return;
  }

  // !purge <miktar> [@kullanıcı]
  if (command === "purge") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100)
      return message.reply({ embeds: [errorEmbed("1-100 arası sayı gir.")] });
    const targetUser = message.mentions.users.first();
    let messages = await message.channel.messages.fetch({ limit: amount + 1 });
    if (targetUser) {
      messages = messages.filter((m) => m.author.id === targetUser.id);
    }
    await message.channel.bulkDelete(messages, true).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Mesajlar silinemedi: ${e.message}`)] });
    });
    const reply = await message.channel.send({
      embeds: [successEmbed(`${messages.size} mesaj silindi.`)],
    });
    setTimeout(() => reply.delete().catch(() => {}), 3000);
    return;
  }

  // !slowmode <miktar>
  if (command === "slowmode") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const saniye = parseInt(args[0]);
    if (isNaN(saniye) || saniye < 0 || saniye > 21600)
      return message.reply({ embeds: [errorEmbed("0-21600 arası saniye gir.")] });
    await message.channel.setRateLimitPerUser(saniye);
    message.reply({
      embeds: [
        successEmbed(
          saniye === 0
            ? "Yavaş mod kapatıldı."
            : `Yavaş mod **${saniye} saniye** olarak ayarlandı.`
        ),
      ],
    });
    return;
  }

  // !kilit / !kiliti-ac
  if (command === "kilit") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    await message.channel.permissionOverwrites.edit(guild.id, {
      SendMessages: false,
    });
    message.reply({ embeds: [successEmbed("🔒 Kanal kilitlendi.")] });
    return;
  }

  if (command === "kiliti-ac") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    await message.channel.permissionOverwrites.edit(guild.id, {
      SendMessages: null,
    });
    message.reply({ embeds: [successEmbed("🔓 Kanal kilidi açıldı.")] });
    return;
  }

  // !rol-ver / !rol-al <@kullanıcı> <@rol>
  if (command === "rol-ver") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!target || !role)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!rol-ver <@kullanıcı> <@rol>`")] });
    await target.roles.add(role).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Rol verilemedi: ${e.message}`)] });
    });
    message.reply({ embeds: [successEmbed(`${target.user.tag} kullanıcısına ${role.name} rolü verildi.`)] });
    return;
  }

  if (command === "rol-al") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!target || !role)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!rol-al <@kullanıcı> <@rol>`")] });
    await target.roles.remove(role).catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Rol alınamadı: ${e.message}`)] });
    });
    message.reply({ embeds: [successEmbed(`${target.user.tag} kullanıcısından ${role.name} rolü alındı.`)] });
    return;
  }

  // !duyuru <mesaj> [true/false]
  if (command === "duyuru") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const everyone = args[args.length - 1] === "true";
    const text = everyone ? args.slice(0, -1).join(" ") : args.join(" ");
    if (!text)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!duyuru <mesaj> [true/false]`")] });
    const duyuruKanal = guild.channels.cache.get(config.channels.duyuru) || message.channel;
    const embed = mainEmbed("📢 Duyuru", text).setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    });
    duyuruKanal.send({ content: everyone ? "@everyone" : null, embeds: [embed] });
    if (duyuruKanal.id !== message.channel.id)
      message.reply({ embeds: [successEmbed("Duyuru gönderildi!")] });
    return;
  }

  // ── KULLANICI BİLGİ ────────────────────────────────────────────────────────

  // !whois <@kullanıcı veya ID>
  if (command === "whois") {
    const target =
      message.mentions.members.first() ||
      (args[0] ? await guild.members.fetch(args[0]).catch(() => null) : member);
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanıcı bulunamadı!")] });
    const user = target.user;
    const embed = new EmbedBuilder()
      .setColor(config.color.main)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "ID", value: user.id, inline: true },
        { name: "Hesap Oluşturma", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Sunucuya Katılma", value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: "Roller", value: target.roles.cache.map((r) => r).join(", ") || "Yok", inline: false }
      )
      .setFooter({ text: `CombatMC • ${config.mcIp}` })
      .setTimestamp();
    message.reply({ embeds: [embed] });
    return;
  }

  // !userinfo [@kullanıcı]
  if (command === "userinfo") {
    const target = message.mentions.members.first() || member;
    const user = target.user;
    const embed = new EmbedBuilder()
      .setColor(config.color.main)
      .setTitle(`ℹ️ ${user.tag} Bilgileri`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Kullanıcı", value: `${user}`, inline: true },
        { name: "ID", value: user.id, inline: true },
        { name: "Bot?", value: user.bot ? "Evet" : "Hayır", inline: true },
        { name: "Katılma Tarihi", value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:F>`, inline: false },
        { name: "Hesap Tarihi", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `CombatMC • ${config.mcIp}` })
      .setTimestamp();
    message.reply({ embeds: [embed] });
    return;
  }

  // !sahipler — Bot sahipleri (admin)
  if (command === "sahipler") {
    const admins = guild.members.cache.filter((m) => isAdmin(m));
    const adminList = admins.map((m) => `• ${m.user.tag}`).join("\n") || "Bulunamadı";
    const embed = mainEmbed("👑 Sunucu Yönetimi", adminList);
    message.reply({ embeds: [embed] });
    return;
  }

  // !serverinfo
  if (command === "serverinfo") {
    const embed = new EmbedBuilder()
      .setColor(config.color.main)
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: "ID", value: guild.id, inline: true },
        { name: "Sahip", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Üye Sayısı", value: `${guild.memberCount}`, inline: true },
        { name: "Kanal Sayısı", value: `${guild.channels.cache.size}`, inline: true },
        { name: "Rol Sayısı", value: `${guild.roles.cache.size}`, inline: true },
        { name: "MC IP", value: `\`${config.mcIp}\``, inline: true },
        { name: "MC Sürüm", value: `\`${config.mcVersion}\``, inline: true },
        { name: "Oluşturulma", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `CombatMC • ${config.mcIp}` })
      .setTimestamp();
    message.reply({ embeds: [embed] });
    return;
  }

  // !mod-kayit
  if (command === "mod-kayit") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const embed = mainEmbed(
      "📋 Mod Kayıt",
      "Moderatör işlem geçmişi modülü aktif.\n> Bu özellik için veritabanı entegrasyonu gerekir."
    );
    message.reply({ embeds: [embed] });
    return;
  }

  // ── TİCKET SİSTEMİ KOMUTLARI ────────────────────────────────────────────────

  // !ticket-kur [#kanal] — Ticket paneli kur (admin)
  if (command === "ticket-kur") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const targetChannel = message.mentions.channels.first() || message.channel;
    const panel = buildTicketPanel();
    const panelMsg = await targetChannel.send(panel);
    ticketPanelMessages.set(panelMsg.id, targetChannel.id);
    message.reply({ embeds: [successEmbed(`Ticket paneli ${targetChannel} kanalına kuruldu!`)] });
    return;
  }

  // !ticket-kapat [sebep] — Ticket kanalını kapat
  if (command === "ticket-kapat") {
    const sebep = args.join(" ") || "Sebep belirtilmedi";
    const topic = message.channel.topic || "";
    if (!topic.includes("|")) {
      return message.reply({ embeds: [errorEmbed("Bu bir ticket kanalı değil!")] });
    }
    const userId = topic.split(" | ")[2];
    if (userId) openTickets.delete(userId);

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(config.color.warn)
          .setDescription(`🔒 **Ticket kapatılıyor...**\n**Sebep:** ${sebep}`)
          .setTimestamp(),
      ],
    });
    setTimeout(() => message.channel.delete("Ticket kapatıldı").catch(() => {}), 3000);
    return;
  }

  // !ticket-liste — Açık ticketleri listele
  if (command === "ticket-liste") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const ticketChannels = guild.channels.cache.filter((c) =>
      c.name.startsWith("ticket-") && c.topic
    );
    if (!ticketChannels.size) {
      return message.reply({ embeds: [mainEmbed("🎫 Açık Ticketler", "Açık ticket yok.")] });
    }
    const list = ticketChannels.map((c) => `• ${c} — ${c.topic}`).join("\n");
    message.reply({
      embeds: [mainEmbed(`🎫 Açık Ticketler (${ticketChannels.size})`, list)],
    });
    return;
  }

  // !ticket-sil [#kanal] — Ticket sil (admin)
  if (command === "ticket-sil") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.channels.first() || message.channel;
    await target.delete("Admin tarafından silindi").catch((e) => {
      return message.reply({ embeds: [errorEmbed(`Silinemedi: ${e.message}`)] });
    });
    return;
  }

  // !ticket-aktar <@yetkili> — Ticketi aktar
  if (command === "ticket-aktar") {
    if (!isMod(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target)
      return message.reply({ embeds: [errorEmbed("Kullanım: `!ticket-aktar <@yetkili>`")] });
    await message.channel.permissionOverwrites.edit(target, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    message.reply({
      embeds: [successEmbed(`Ticket **${target.user.tag}** kullanıcısına aktarıldı.`)],
    });
    return;
  }

  // !ticket-istatistikler
  if (command === "ticket-istatistikler") {
    if (!isAdmin(member))
      return message.reply({ embeds: [errorEmbed("Yetkin yok!")] });
    const ticketChannels = guild.channels.cache.filter((c) => c.name.startsWith("ticket-")).size;
    const embed = mainEmbed(
      "📊 Ticket İstatistikleri",
      `**Açık Ticketler:** ${ticketChannels}\n**Toplam Açılan:** Veritabanı gerekir`
    );
    message.reply({ embeds: [embed] });
    return;
  }

  // ── YARDIM KOMUTU ────────────────────────────────────────────────────────────
  if (command === "yardim" || command === "help") {
    const embed = new EmbedBuilder()
      .setColor(config.color.main)
      .setTitle("⚔️ CombatMC Bot — Komut Listesi")
      .setDescription(`Prefix: \`${config.prefix}\``)
      .addFields(
        {
          name: "🖥️ Sunucu Yönetim",
          value: "`aktif` `bakim` `oyuncu-sayisi` `duyuru`",
          inline: false,
        },
        {
          name: "🎉 Etkinlik & Topluluk",
          value: "`oneri` `cekilis-baslat` `hata-bildir`",
          inline: false,
        },
        {
          name: "🔨 Moderasyon",
          value: "`ban` `unban` `kick` `mute` `unmute` `warn` `waro` `karaliste` `purge` `slowmode` `kilit` `kiliti-ac` `rol-ver` `rol-al`",
          inline: false,
        },
        {
          name: "👤 Kullanıcı Bilgi",
          value: "`whois` `userinfo` `sahipler` `serverinfo` `mod-kayit`",
          inline: false,
        },
        {
          name: "🎫 Ticket",
          value: "`ticket-kur` `ticket-kapat` `ticket-liste` `ticket-sil` `ticket-aktar` `ticket-istatistikler`",
          inline: false,
        }
      )
      .setFooter({ text: `CombatMC • ${config.mcIp} • ${config.mcVersion}` })
      .setTimestamp();
    message.reply({ embeds: [embed] });
    return;
  }
});

// ─── INTERACTION HANDLER (Buton & Select) ─────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  // Select Menu — Ticket Kategori
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category") {
    const category = interaction.values[0];
    await createTicket(interaction, category);
    return;
  }

  // Button — Ticket Kapat
  if (interaction.isButton() && interaction.customId === "ticket_close") {
    await closeTicket(interaction);
    return;
  }

  // Button — Ticket Üstlen
  if (interaction.isButton() && interaction.customId === "ticket_claim") {
    const member = interaction.member;
    if (!isMod(member)) {
      return interaction.reply({
        embeds: [errorEmbed("Yetkin yok!")],
        ephemeral: true,
      });
    }
    await interaction.channel.permissionOverwrites.edit(member, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
    interaction.reply({
      embeds: [
        successEmbed(`✋ ${member.user.tag} bu ticketi üstlendi.`),
      ],
    });
    return;
  }
});

// ─── BOT HAZIR ────────────────────────────────────────────────────────────────
client.on("ready", () => {
  console.log(`
╔══════════════════════════════════════╗
║   ⚔️  CombatMC Bot — Aktif!  ⚔️      ║
╠══════════════════════════════════════╣
║  Bot: ${client.user.tag.padEnd(30)}║
║  MC : ${config.mcIp.padEnd(30)}║
║  Ver: ${config.mcVersion.padEnd(30)}║
╚══════════════════════════════════════╝
  `);
  client.user.setPresence({
    activities: [{ name: `⚔️ ${config.mcIp}`, type: 0 }],
    status: "online",
  });
});

// ─── GİRİŞ ────────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
