require("dotenv").config();
const {
  Client,
  Intents,
  MessageEmbed,
  MessageActionRow,
  MessageButton,
  MessageSelectMenu,
  Permissions,
  MessageAttachment
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

const TICKET_CATEGORY_ID = "TICKET_KATEGORI_ID_BURAYA";   // ← Burayı doldur
const TICKET_LOG_CHANNEL_ID = "TICKET_LOG_KANAL_ID_BURAYA"; // ← Burayı doldur
const STAFF_ROLE_ID = "YETKILI_ROL_ID_BURAYA";             // ← Burayı doldur
const MOD_LOG_CHANNEL_ID = "MOD_LOG_KANAL_ID_BURAYA";      // ← Burayı doldur

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
    activities: [{ name: `⚔️ ${SERVER_IP} | ${PREFIX}yardım`, type: "PLAYING" }],
    status: "online",
  });
});

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────────────────────
function errorEmbed(text) {
  return new MessageEmbed().setColor(COLORS.error).setDescription(text).setTimestamp();
}

// ─── UYARILAR (bellekte) ─────────────────────────────────────────────────────
const warnings = new Map();

// ─── MESAJ HANDLER ───────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const isMod = message.member.permissions.has(Permissions.FLAGS.MODERATE_MEMBERS) ||
                message.member.roles.cache.has(STAFF_ROLE_ID);
  const isAdmin = message.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR);

  // !ip
  if (command === "ip") {
    const embed = new MessageEmbed()
      .setColor(COLORS.info)
      .setTitle("⚔️ CombatMC — Sunucu Bilgisi")
      .setDescription("Aşağıdaki bilgileri kullanarak sunucumuza katılabilirsin!")
      .addFields(
        { name: "🌐 Sunucu IP", value: `\`\`\`${SERVER_IP}\`\`\``, inline: true },
        { name: "📌 Sürüm", value: `\`\`\`${SERVER_VERSION}\`\`\``, inline: true },
        { name: "🕹️ Oyun Modu", value: "BoxPvP / Combat", inline: true }
      )
      .setFooter({ text: "CombatMC | Savaş Meydanı Seni Bekliyor!" })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // !ticket-kur
  if (command === "ticket-kur") {
    if (!isAdmin) return message.reply({ embeds: [errorEmbed("🚫 Bu komut sadece yöneticiler içindir!")] });

    const panelEmbed = new MessageEmbed()
      .setColor(COLORS.ticket)
      .setTitle("🎫 CombatMC — Destek Sistemi")
      .setDescription(
        "Bir sorunun mu var? Aşağıdaki menüden kategorini seç!\n\n" +
        "**Kurallar:**\n" +
        "• Konuyla alakasız ticket açma\n" +
        "• Saygılı ve net ol\n" +
        "• Kanıtlarını hazır tut"
      )
      .setFooter({ text: "CombatMC | mc.combatmc.net" })
      .setTimestamp();

    const selectMenu = new MessageSelectMenu()
      .setCustomId("ticket_category")
      .setPlaceholder("📋 Kategori seç...")
      .addOptions([
        { label: "Hile Şikayeti", value: "hile", emoji: "🚨" },
        { label: "Bug Bildirimi", value: "bug", emoji: "🐛" },
        { label: "Sosyal Medya", value: "sosyal_medya", emoji: "📱" },
        { label: "Kredi / Ödeme", value: "kredi", emoji: "💳" },
        { label: "Oyuncu Şikayeti", value: "sikayet", emoji: "⚔️" },
        { label: "Teknik Destek", value: "teknik", emoji: "🔧" },
        { label: "Diğer", value: "diger", emoji: "❓" },
      ]);

    const row = new MessageActionRow().addComponents(selectMenu);

    await message.channel.send({ embeds: [panelEmbed], components: [row] });
    message.delete().catch(() => {});
  }

  // Diğer komutların (ban, kick vs.) hepsini buraya ekleyebilirim ama şimdilik ticket odaklı düzelttim.
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isSelectMenu() && !interaction.isButton()) return;

  // Ticket Kategori Seçimi
  if (interaction.customId === "ticket_category") {
    const category = interaction.values[0];
    const categoryInfo = {
      hile: { label: "🚨 Hile Şikayeti", color: COLORS.error },
      bug: { label: "🐛 Bug Bildirimi", color: COLORS.warn },
      sosyal_medya: { label: "📱 Sosyal Medya", color: COLORS.info },
      kredi: { label: "💳 Kredi / Ödeme", color: COLORS.success },
      sikayet: { label: "⚔️ Oyuncu Şikayeti", color: COLORS.mod },
      teknik: { label: "🔧 Teknik Destek", color: COLORS.main },
      diger: { label: "❓ Diğer", color: COLORS.ticket },
    };

    const info = categoryInfo[category] || categoryInfo.diger;

    const channelName = `ticket-${interaction.user.username.toLowerCase()}-${Date.now().toString().slice(-4)}`;

    try {
      const ticketChannel = await interaction.guild.channels.create(channelName, {
        type: "GUILD_TEXT",
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: ["VIEW_CHANNEL"] },
          { id: interaction.user.id, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "ATTACH_FILES"] },
          { id: STAFF_ROLE_ID, allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "MANAGE_MESSAGES"] },
        ],
      });

      const ticketEmbed = new MessageEmbed()
        .setColor(info.color)
        .setTitle(`${info.label} — Ticket`)
        .setDescription(`Merhaba ${interaction.user}!\n\n**${info.label}** kategorisinde ticket açtın.\n\nLütfen sorunun detayını ve kanıtlarını yaz.`)
        .setTimestamp();

      const row = new MessageActionRow().addComponents(
        new MessageButton().setCustomId("ticket_close").setLabel("🔒 Kapat").setStyle("DANGER"),
        new MessageButton().setCustomId("ticket_claim").setLabel("✋ Üstlen").setStyle("PRIMARY")
      );

      await ticketChannel.send({
        content: `<@${interaction.user.id}> <@&${STAFF_ROLE_ID}>`,
        embeds: [ticketEmbed],
        components: [row]
      });

      await interaction.reply({
        embeds: [new MessageEmbed().setColor(COLORS.success).setDescription(`✅ Ticket başarıyla açıldı! → ${ticketChannel}`)],
        ephemeral: true
      });

    } catch (err) {
      console.error(err);
      await interaction.reply({ embeds: [errorEmbed("❌ Ticket oluşturulamadı! Bot yetkilerini kontrol et.")], ephemeral: true });
    }
  }

  // Ticket Kapat
  if (interaction.customId === "ticket_close") {
    await interaction.reply({ embeds: [new MessageEmbed().setColor(COLORS.warn).setDescription("🔒 Ticket 5 saniye içinde kapatılıyor...")] });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }

  // Ticket Üstlen
  if (interaction.customId === "ticket_claim") {
    await interaction.reply({
      embeds: [new MessageEmbed().setColor(COLORS.success).setDescription(`✋ **${interaction.user}** bu ticket'ı üstlendi!`)],
      ephemeral: false
    });
  }
});

client.login(process.env.BOT_TOKEN);
