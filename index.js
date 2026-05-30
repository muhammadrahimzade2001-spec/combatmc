require("dotenv").config();

const {
  Client,
  Intents,
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
  Permissions,
} = require("discord.js");

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.DIRECT_MESSAGES,
  ],
  partials: ["CHANNEL", "MESSAGE"],
});

// ─── AYARLAR ────────────────────────────────────────────────────────────────
const PREFIX = "!";
const SERVER_IP = "mc.combatmc.net";
const SERVER_VERSION = "1.16.5+";
const TICKET_CATEGORY_ID = "TICKET_KATEGORI_ID_BURAYA";
const TICKET_LOG_CHANNEL_ID = "TICKET_LOG_KANAL_ID_BURAYA";
const STAFF_ROLE_ID = "YETKILI_ROL_ID_BURAYA";
const MOD_LOG_CHANNEL_ID = "MOD_LOG_KANAL_ID_BURAYA";

// ─── RENK PALETİ ─────────────────────────────────────────────────────────────
const COLORS = {
  main: "#2b2d31",
  success: "#57f287",
  error: "#ed4245",
  warn: "#fee75c",
  info: "#5865f2",
  ticket: "#eb459e",
  mod: "#ff7043",
};

// ─── READY ───────────────────────────────────────────────────────────────────
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} olarak giriş yapıldı!`);
  client.user.setPresence({
    activities: [{ name: `⚔️ mc.combatmc.net | ${PREFIX}yardım`, type: "PLAYING" }],
    status: "online",
  });
});

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────
function errorEmbed(text) {
  return new MessageEmbed().setColor(COLORS.error).setDescription(text).setTimestamp();
}

function modEmbed(title, color, target, mod, reason) {
  return new MessageEmbed()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: "👤 Kullanıcı", value: `${target} (${target.tag})`, inline: true },
      { name: "👮 Yetkili", value: `${mod}`, inline: true },
      { name: "📄 Sebep", value: reason }
    )
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setTimestamp();
}

function logMod(guild, embed) {
  const logCh = guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
  if (logCh) logCh.send({ embeds: [embed] });
}

// ─── UYARILAR (bellekte, gerçek projede DB kullan) ────────────────────────────
const warnings = new Map();

// ─── MESAJ HANDLER ───────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const isMod =
    message.member.permissions.has(Permissions.FLAGS.MODERATE_MEMBERS) ||
    message.member.roles.cache.has(STAFF_ROLE_ID);
  const isAdmin = message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR);

  // ── !ip ──────────────────────────────────────
  if (command === "ip") {
    const embed = new MessageEmbed()
      .setColor(COLORS.info)
      .setTitle("⚔️ CombatMC — Sunucu Bilgisi")
      .setDescription("Aşağıdaki bilgileri kullanarak sunucumuza katılabilirsin!")
      .addFields(
        { name: "🌐 Sunucu IP", value: `\`\`\`${SERVER_IP}\`\`\``, inline: true },
        { name: "📌 Sürüm", value: `\`\`\`${SERVER_VERSION}\`\`\``, inline: true },
        { name: "🕹️ Oyun Modu", value: "Combat / PvP / SMP", inline: true }
      )
      .setFooter({ text: "CombatMC | Savaş Meydanı Seni Bekliyor!" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ── !bot ──────────────────────────────────────
  if (command === "bot") {
    const embed = new MessageEmbed()
      .setColor(COLORS.main)
      .setTitle("🤖 CombatMC Bot")
      .setDescription("CombatMC Discord sunucusunun özel yönetim botu!")
      .addFields(
        { name: "⚙️ Prefix", value: `\`${PREFIX}\``, inline: true },
        { name: "📡 Ping", value: `\`${client.ws.ping}ms\``, inline: true },
        { name: "🏓 Uptime", value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
        { name: "📚 Komutlar", value: "`!ip` `!bot` `!yardım` `!ban` `!kick` `!mute` `!unmute` `!warn` `!uyarılar` `!temizle` `!ticket-kur`" }
      )
      .setFooter({ text: `${client.guilds.cache.size} sunucuda aktif` })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ── !yardım ───────────────────────────────────
  if (command === "yardım" || command === "yardim" || command === "help") {
    const embed = new MessageEmbed()
      .setColor(COLORS.info)
      .setTitle("📋 CombatMC Bot — Komutlar")
      .addFields(
        { name: "🌐 Genel", value: "`!ip` — Sunucu IP\n`!bot` — Bot bilgisi\n`!yardım` — Bu mesaj" },
        {
          name: "🔨 Moderasyon",
          value:
            "`!ban @kullanıcı [sebep]`\n`!unban <ID>`\n`!kick @kullanıcı [sebep]`\n`!mute @kullanıcı [süre] [sebep]`\n`!unmute @kullanıcı`\n`!warn @kullanıcı [sebep]`\n`!uyarılar @kullanıcı`\n`!temizle [miktar]`",
        },
        { name: "🎫 Ticket", value: "`!ticket-kur` — Ticket panelini kur (Yönetici)" }
      )
      .setFooter({ text: "CombatMC | mc.combatmc.net" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ── !ban ──────────────────────────────────────
  if (command === "ban") {
    if (!message.member.permissions.has(Permissions.FLAGS.BAN_MEMBERS))
      return message.reply({ embeds: [errorEmbed("🚫 Ban yetkisine sahip değilsin!")] });

    const target = message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);
    if (!target) return message.reply({ embeds: [errorEmbed("❌ Kullanıcı bulunamadı!")] });

    const reason = args.slice(1).join(" ") || "Sebep belirtilmedi.";
    try {
      await target.send({
        embeds: [new MessageEmbed().setColor(COLORS.error).setTitle("🔨 Yasaklandın")
          .addFields({ name: "📄 Sebep", value: reason })],
      }).catch(() => {});
      await target.ban({ reason });
      const embed = modEmbed("🔨 Kullanıcı Yasaklandı", COLORS.error, target.user, message.author, reason);
      message.reply({ embeds: [embed] });
      logMod(message.guild, embed);
    } catch { message.reply({ embeds: [errorEmbed("❌ Banlanamadı!")] }); }
    return;
  }

  // ── !unban ────────────────────────────────────
  if (command === "unban") {
    if (!message.member.permissions.has(Permissions.FLAGS.BAN_MEMBERS))
      return message.reply({ embeds: [errorEmbed("🚫 Yetkin yok!")] });
    const userId = args[0];
    if (!userId) return message.reply({ embeds: [errorEmbed("❌ Kullanıcı ID gir!")] });
    try {
      await message.guild.bans.remove(userId);
      const embed = new MessageEmbed().setColor(COLORS.success).setTitle("✅ Ban Kaldırıldı")
        .addFields(
          { name: "👤 ID", value: userId, inline: true },
          { name: "👮 Yetkili", value: `${message.author}`, inline: true }
        ).setTimestamp();
      message.reply({ embeds: [embed] });
      logMod(message.guild, embed);
    } catch { message.reply({ embeds: [errorEmbed("❌ Kullanıcı bulunamadı veya banlı değil!")] }); }
    return;
  }

  // ── !kick ─────────────────────────────────────
  if (command === "kick") {
    if (!message.member.permissions.has(Permissions.FLAGS.KICK_MEMBERS))
      return message.reply({ embeds: [errorEmbed("🚫 Kick yetkisine sahip değilsin!")] });
    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [errorEmbed("❌ Kullanıcı belirt!")] });
    const reason = args.slice(1).join(" ") || "Sebep belirtilmedi.";
    try {
      await target.send({
        embeds: [new MessageEmbed().setColor(COLORS.warn).setTitle("👢 Sunucudan Atıldın")
          .addFields({ name: "📄 Sebep", value: reason })],
      }).catch(() => {});
      await target.kick(reason);
      const embed = modEmbed("👢 Kullanıcı Atıldı", COLORS.warn, target.user, message.author, reason);
      message.reply({ embeds: [embed] });
      logMod(message.guild, embed);
    } catch { message.reply({ embeds: [errorEmbed("❌ Kick atılamadı!")] }); }
    return;
  }

  // ── !mute ─────────────────────────────────────
  if (command === "mute") {
    if (!isMod) return message.reply({ embeds: [errorEmbed("🚫 Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [errorEmbed("❌ Kullanıcı belirt!")] });

    let durationMs = 10 * 60 * 1000;
    let durationStr = "10 dakika";
    const dArg = args[1];
    if (dArg) {
      const match = dArg.match(/^(\d+)(s|m|h|d)$/i);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const map = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        const names = { s: "saniye", m: "dakika", h: "saat", d: "gün" };
        durationMs = num * map[unit];
        durationStr = `${num} ${names[unit]}`;
      }
    }
    const reason = args.slice(2).join(" ") || "Sebep belirtilmedi.";
    try {
      await target.timeout(durationMs, reason);
      const embed = new MessageEmbed().setColor(COLORS.warn).setTitle("🔇 Kullanıcı Susturuldu")
        .addFields(
          { name: "👤 Kullanıcı", value: `${target}`, inline: true },
          { name: "👮 Yetkili", value: `${message.author}`, inline: true },
          { name: "⏱️ Süre", value: durationStr, inline: true },
          { name: "📄 Sebep", value: reason }
        ).setTimestamp();
      message.reply({ embeds: [embed] });
      logMod(message.guild, embed);
    } catch { message.reply({ embeds: [errorEmbed("❌ Susturulamadı!")] }); }
    return;
  }

  // ── !unmute ───────────────────────────────────
  if (command === "unmute") {
    if (!isMod) return message.reply({ embeds: [errorEmbed("🚫 Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [errorEmbed("❌ Kullanıcı belirt!")] });
    try {
      await target.timeout(null);
      const embed = new MessageEmbed().setColor(COLORS.success).setTitle("🔊 Susturma Kaldırıldı")
        .addFields(
          { name: "👤 Kullanıcı", value: `${target}`, inline: true },
          { name: "👮 Yetkili", value: `${message.author}`, inline: true }
        ).setTimestamp();
      message.reply({ embeds: [embed] });
      logMod(message.guild, embed);
    } catch { message.reply({ embeds: [errorEmbed("❌ İşlem başarısız!")] }); }
    return;
  }

  // ── !warn ─────────────────────────────────────
  if (command === "warn") {
    if (!isMod) return message.reply({ embeds: [errorEmbed("🚫 Yetkin yok!")] });
    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [errorEmbed("❌ Kullanıcı belirt!")] });
    const reason = args.slice(1).join(" ") || "Sebep belirtilmedi.";
    const key = `${message.guild.id}-${target.id}`;
    const existing = warnings.get(key) || [];
    existing.push({ reason, mod: message.author.tag, date: new Date().toLocaleDateString("tr-TR") });
    warnings.set(key, existing);

    const embed = new MessageEmbed().setColor(COLORS.warn).setTitle("⚠️ Kullanıcı Uyarıldı")
      .addFields(
        { name: "👤 Kullanıcı", value: `${target}`, inline: true },
        { name: "👮 Yetkili", value: `${message.author}`, inline: true },
        { name: "🔢 Toplam", value: `${existing.length}`, inline: true },
        { name: "📄 Sebep", value: reason }
      ).setTimestamp();
    message.reply({ embeds: [embed] });
    logMod(message.guild, embed);
    target.send({
      embeds: [new MessageEmbed().setColor(COLORS.warn).setTitle("⚠️ Uyarı Aldın")
        .addFields({ name: "📄 Sebep", value: reason }, { name: "🔢 Toplam", value: `${existing.length}` })],
    }).catch(() => {});
    return;
  }

  // ── !uyarılar ─────────────────────────────────
  if (command === "uyarılar" || command === "uyarilar" || command === "warns") {
    const target = message.mentions.members.first() || message.member;
    const key = `${message.guild.id}-${target.id}`;
    const warnList = warnings.get(key) || [];
    const embed = new MessageEmbed().setColor(COLORS.info)
      .setTitle(`📋 ${target.user.username} — Uyarı Geçmişi`)
      .setDescription(
        warnList.length === 0
          ? "✅ Hiç uyarısı yok!"
          : warnList.map((w, i) => `**${i + 1}.** ${w.reason} — *${w.mod}* (${w.date})`).join("\n")
      )
      .addFields({ name: "🔢 Toplam", value: `${warnList.length}`, inline: true })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ── !temizle ──────────────────────────────────
  if (command === "temizle" || command === "clear" || command === "purge") {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES))
      return message.reply({ embeds: [errorEmbed("🚫 Yetkin yok!")] });
    const amount = parseInt(args[0]) || 10;
    if (amount < 1 || amount > 100)
      return message.reply({ embeds: [errorEmbed("❌ 1-100 arası bir sayı gir!")] });
    await message.channel.bulkDelete(amount + 1, true).catch(() => {});
    const msg = await message.channel.send({
      embeds: [new MessageEmbed().setColor(COLORS.success).setDescription(`🗑️ **${amount}** mesaj silindi!`)],
    });
    setTimeout(() => msg.delete().catch(() => {}), 3000);
    return;
  }

  // ── !ticket-kur ───────────────────────────────
  if (command === "ticket-kur") {
    if (!isAdmin)
      return message.reply({ embeds: [errorEmbed("🚫 Bu komut sadece yöneticiler içindir!")] });

    const panelEmbed = new MessageEmbed()
      .setColor(COLORS.ticket)
      .setTitle("🎫 CombatMC — Destek Sistemi")
      .setDescription(
        "```\n⚔️  COMBATMC DESTEK MERKEZİ  ⚔️\n```\n" +
        "Bir sorunun mu var? Aşağıdaki menüden kategorini seç!\n\n" +
        "📌 **Kurallar:**\n" +
        "• Konuyla ilgili olmayan ticket açma\n" +
        "• Saygılı ve açıklayıcı ol\n" +
        "• Kanıtlarını hazır bulundur\n\n" +
        "⏰ Ortalama yanıt süresi: **15 dakika**"
      )
      .setFooter({ text: "CombatMC | mc.combatmc.net", iconURL: message.guild.iconURL() })
      .setTimestamp();

    const selectMenu = new MessageSelectMenu()
      .setCustomId("ticket_category")
      .setPlaceholder("📋 Kategori seç...")
      .addOptions([
        { label: "Hile Şikayeti", description: "Hile yapan oyuncu bildirmek için", value: "hile", emoji: "🚨" },
        { label: "Bug Bildirimi", description: "Bulduğun bir bug bildirmek için", value: "bug", emoji: "🐛" },
        { label: "Sosyal Medya", description: "İçerik üreticisi başvurusu", value: "sosyal_medya", emoji: "📱" },
        { label: "Kredi / Ödeme", description: "Satın alma ve ödeme sorunları", value: "kredi", emoji: "💳" },
        { label: "Oyuncu Şikayeti", description: "Taciz veya kural ihlali bildirimi", value: "sikayet", emoji: "⚔️" },
        { label: "Teknik Destek", description: "Bağlantı ve teknik sorunlar", value: "teknik", emoji: "🔧" },
        { label: "Diğer", description: "Diğer tüm konular", value: "diger", emoji: "❓" },
      ]);

    const row = new MessageActionRow().addComponents(selectMenu);
    await message.channel.send({ embeds: [panelEmbed], components: [row] });
    message.delete().catch(() => {});
    return;
  }
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {

  // ── Ticket Kategori Seçimi ─────────────────────
  if (interaction.isSelectMenu() && interaction.customId === "ticket_category") {
    const category = interaction.values[0];
    const categoryInfo = {
      hile:        { label: "🚨 Hile Şikayeti",    color: COLORS.error   },
      bug:         { label: "🐛 Bug Bildirimi",     color: COLORS.warn    },
      sosyal_medya:{ label: "📱 Sosyal Medya",      color: COLORS.info    },
      kredi:       { label: "💳 Kredi / Ödeme",     color: COLORS.success },
      sikayet:     { label: "⚔️ Oyuncu Şikayeti",  color: COLORS.mod     },
      teknik:      { label: "🔧 Teknik Destek",     color: COLORS.main    },
      diger:       { label: "❓ Diğer",             color: COLORS.ticket  },
    };
    const info = categoryInfo[category];
    const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString().slice(-4)}`;
    const ticketCategory = interaction.guild.channels.cache.get(TICKET_CATEGORY_ID);

    try {
      const ticketChannel = await interaction.guild.channels.create(channelName, {
        type: "GUILD_TEXT",
        parent: ticketCategory || null,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: ["VIEW_CHANNEL"] },
          { id: interaction.user.id, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "ATTACH_FILES"] },
          { id: STAFF_ROLE_ID, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "MANAGE_MESSAGES"] },
        ],
      });

      const ticketEmbed = new MessageEmbed()
        .setColor(info.color)
        .setTitle(`${info.label} — Ticket Açıldı`)
        .setDescription(
          `Merhaba ${interaction.user}! 👋\n\n` +
          `**${info.label}** kategorisinde ticket açtın.\n\n` +
          `📝 **Lütfen şunları belirt:**\n` +
          `• Kullanıcı adın (MC)\n• Sorunun detayı\n• Varsa ekran görüntüsü\n\n` +
          `⏳ Bir yetkili en kısa sürede yardımcı olacak!`
        )
        .setFooter({ text: `Ticket ID: ${ticketChannel.id}` })
        .setTimestamp();

      const closeRow = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("ticket_close").setLabel("🔒 Kapat").setStyle("DANGER"),
        new MessageButton().setCustomId("ticket_claim").setLabel("✋ Üstlen").setStyle("PRIMARY"),
        new MessageButton().setCustomId("ticket_transcript").setLabel("📄 Transkript").setStyle("SECONDARY")
      );

      await ticketChannel.send({
        content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`,
        embeds: [ticketEmbed],
        components: [closeRow],
      });

      await interaction.reply({
        embeds: [new MessageEmbed().setColor(COLORS.success)
          .setDescription(`✅ Ticket açıldı! → ${ticketChannel}\n\n🔒 Kanal sadece sana ve yetkililere görünür.`)],
        ephemeral: true,
      });

      const logChannel = interaction.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [new MessageEmbed().setColor(info.color).setTitle("🎫 Yeni Ticket")
            .addFields(
              { name: "👤 Kullanıcı", value: `${interaction.user.tag}`, inline: true },
              { name: "📂 Kategori", value: info.label, inline: true },
              { name: "📌 Kanal", value: `${ticketChannel}`, inline: true }
            ).setTimestamp()],
        });
      }
    } catch (err) {
      console.error("Ticket hatası:", err);
      await interaction.reply({
        embeds: [errorEmbed("❌ Ticket oluşturulamadı! Bot yetkileri kontrol et.")],
        ephemeral: true,
      });
    }
    return;
  }

  // ── Ticket Kapat ──────────────────────────────
  if (interaction.isButton() && interaction.customId === "ticket_close") {
    await interaction.reply({
      embeds: [new MessageEmbed().setColor(COLORS.warn).setTitle("🔒 Kapatılıyor")
        .setDescription("Ticket **5 saniye** içinde kapatılacak...").setTimestamp()],
    });
    const logChannel = interaction.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send({
        embeds: [new MessageEmbed().setColor(COLORS.error).setTitle("🔒 Ticket Kapatıldı")
          .addFields(
            { name: "👤 Kapatan", value: `${interaction.user}`, inline: true },
            { name: "📌 Kanal", value: interaction.channel.name, inline: true }
          ).setTimestamp()],
      });
    }
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    return;
  }

  // ── Ticket Üstlen ─────────────────────────────
  if (interaction.isButton() && interaction.customId === "ticket_claim") {
    await interaction.reply({
      embeds: [new MessageEmbed().setColor(COLORS.success)
        .setDescription(`✋ **${interaction.user}** bu ticket'ı üstlendi!`).setTimestamp()],
    });
    return;
  }

  // ── Transkript ────────────────────────────────
  if (interaction.isButton() && interaction.customId === "ticket_transcript") {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = messages.reverse()
      .map((m) => `[${new Date(m.createdTimestamp).toLocaleString("tr-TR")}] ${m.author.tag}: ${m.content}`)
      .join("\n");
    const logChannel = interaction.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
    if (logChannel && transcript) {
      const { MessageAttachment } = require("discord.js");
      const attachment = new MessageAttachment(
        Buffer.from(transcript, "utf-8"),
        `transkript-${interaction.channel.name}.txt`
      );
      logChannel.send({
        embeds: [new MessageEmbed().setColor(COLORS.info).setTitle("📄 Transkript")
          .addFields({ name: "📌 Kanal", value: interaction.channel.name })],
        files: [attachment],
      });
    }
    await interaction.reply({
      embeds: [new MessageEmbed().setColor(COLORS.success).setDescription("📄 Transkript log kanalına gönderildi!")],
      ephemeral: true,
    });
    return;
  }
});

// ─── GİRİŞ ───────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
