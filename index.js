const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Collection, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ]
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  SERVER_NAME: 'CombatMC',
  SERVER_IP: 'mc.combatmc.net',
  COLOR_PRIMARY: 0xFF4444,
  COLOR_SUCCESS: 0x00FF88,
  COLOR_WARNING: 0xFFAA00,
  COLOR_INFO: 0x4488FF,
  COLOR_DARK: 0x1A1A2E,
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || null,
  MOD_ROLE_ID: process.env.MOD_ROLE_ID || null,
  ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID || null,
};

// ─── KÜFÜR LİSTESİ ────────────────────────────────────────────────────────────
const BANNED_WORDS = [
  'orospu', 'oç', 'göt', 'sik', 'amk', 'amına', 'bok', 'yarrak', 'piç',
  'ibne', 'götveren', 'orospu çocuğu', 'oğlan', 'kaltak', 'fahişe',
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'nigga', 'nigger',
  'bastard', 'motherfucker', 'asshole', 'cunt',
];

function containsBannedWord(text) {
  const lower = text.toLowerCase().replace(/[^a-zçğıöşüa-z0-9 ]/gi, '');
  return BANNED_WORDS.some(w => lower.includes(w));
}

// ─── UYARI SİSTEMİ ────────────────────────────────────────────────────────────
const warnings = new Map(); // userId -> [{reason, date}]

function addWarning(userId, reason) {
  if (!warnings.has(userId)) warnings.set(userId, []);
  warnings.get(userId).push({ reason, date: new Date() });
  return warnings.get(userId).length;
}

function getWarnings(userId) {
  return warnings.get(userId) || [];
}

function clearWarnings(userId) {
  warnings.delete(userId);
}

// ─── COOLDOWN ─────────────────────────────────────────────────────────────────
const cooldowns = new Collection();

function checkCooldown(userId, command, seconds) {
  const key = `${userId}-${command}`;
  const now = Date.now();
  if (cooldowns.has(key)) {
    const remaining = (cooldowns.get(key) + seconds * 1000) - now;
    if (remaining > 0) return Math.ceil(remaining / 1000);
  }
  cooldowns.set(key, now);
  return 0;
}

// ─── EMBED FACTORY ────────────────────────────────────────────────────────────
function makeEmbed(title, description, color = CONFIG.COLOR_PRIMARY, footer = true) {
  const e = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  if (footer) e.setFooter({ text: `${CONFIG.SERVER_NAME} • ${CONFIG.SERVER_IP}` });
  return e;
}

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
const commands = [
  // Server info
  new SlashCommandBuilder().setName('sunucu').setDescription('CombatMC sunucu bilgilerini gösterir'),
  new SlashCommandBuilder().setName('ip').setDescription('Sunucu IP adresini gösterir'),
  new SlashCommandBuilder().setName('kurallar').setDescription('Sunucu kurallarını gösterir'),
  new SlashCommandBuilder().setName('yardim').setDescription('Tüm komutları listeler'),

  // Ticket
  new SlashCommandBuilder().setName('ticket').setDescription('Destek talebi oluşturur'),
  new SlashCommandBuilder()
    .setName('ticketkapat')
    .setDescription('Mevcut ticketi kapatır')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  // Moderation
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Kullanıcıya uyarı verir')
    .addUserOption(o => o.setName('kullanici').setDescription('Uyarılacak kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Uyarı sebebi').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  new SlashCommandBuilder()
    .setName('uyarilar')
    .setDescription('Kullanıcının uyarılarını gösterir')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  new SlashCommandBuilder()
    .setName('uyarisil')
    .setDescription('Kullanıcının uyarılarını temizler')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Kullanıcıyı susturur')
    .addUserOption(o => o.setName('kullanici').setDescription('Susturulacak kullanıcı').setRequired(true))
    .addIntegerOption(o => o.setName('sure').setDescription('Süre (dakika)').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Kullanıcının susturmasını kaldırır')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kullanıcıyı sunucudan atar')
    .addUserOption(o => o.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep'))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Kullanıcıyı yasaklar')
    .addUserOption(o => o.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep'))
    .addIntegerOption(o => o.setName('silme').setDescription('Silinecek mesaj gün sayısı (0-7)').setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Kullanıcının yasağını kaldırır')
    .addStringOption(o => o.setName('id').setDescription('Kullanıcı ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),

  new SlashCommandBuilder()
    .setName('temizle')
    .setDescription('Belirtilen sayıda mesajı siler')
    .addIntegerOption(o => o.setName('adet').setDescription('Silinecek mesaj sayısı (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  // Fun / Utility
  new SlashCommandBuilder()
    .setName('kullanici')
    .setDescription('Kullanıcı bilgilerini gösterir')
    .addUserOption(o => o.setName('kullanici').setDescription('Kullanıcı').setRequired(false)),

  new SlashCommandBuilder().setName('sunucuinfo').setDescription('Discord sunucu istatistiklerini gösterir'),

  new SlashCommandBuilder()
    .setName('anket')
    .setDescription('Anket oluşturur')
    .addStringOption(o => o.setName('soru').setDescription('Anket sorusu').setRequired(true))
    .addStringOption(o => o.setName('secenek1').setDescription('1. seçenek').setRequired(true))
    .addStringOption(o => o.setName('secenek2').setDescription('2. seçenek').setRequired(true))
    .addStringOption(o => o.setName('secenek3').setDescription('3. seçenek').setRequired(false))
    .addStringOption(o => o.setName('secenek4').setDescription('4. seçenek').setRequired(false)),

  new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('Duyuru gönderir')
    .addStringOption(o => o.setName('mesaj').setDescription('Duyuru mesajı').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  new SlashCommandBuilder()
    .setName('zar')
    .setDescription('Zar atar')
    .addIntegerOption(o => o.setName('yuz').setDescription('Kaç yüzlü zar? (varsayılan: 6)').setMinValue(2).setMaxValue(1000)),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Bot gecikmesini gösterir'),

  new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('YouTube linkini embed olarak paylaşır')
    .addStringOption(o => o.setName('link').setDescription('YouTube linki').setRequired(true)),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Oyun içi rütbenizi gösterir')
    .addStringOption(o => o.setName('kullaniciadi').setDescription('Minecraft kullanıcı adı').setRequired(true)),

  new SlashCommandBuilder()
    .setName('basvuru')
    .setDescription('Moderatör/Yönetici başvurusu oluşturur'),

  new SlashCommandBuilder()
    .setName('sikayet')
    .setDescription('Oyuncu şikayeti oluşturur')
    .addStringOption(o => o.setName('oyuncu').setDescription('Şikayet edilen oyuncu adı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Şikayet sebebi').setRequired(true)),

  new SlashCommandBuilder()
    .setName('embedgonder')
    .setDescription('Özel embed mesaj gönderir')
    .addStringOption(o => o.setName('baslik').setDescription('Başlık').setRequired(true))
    .addStringOption(o => o.setName('icerik').setDescription('İçerik').setRequired(true))
    .addStringOption(o => o.setName('renk').setDescription('Renk hex kodu (örn: FF4444)').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  new SlashCommandBuilder()
    .setName('yavaslat')
    .setDescription('Kanalda yavaş mod açar/kapar')
    .addIntegerOption(o => o.setName('saniye').setDescription('Saniye (0 = kapalı)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),
].map(c => c.toJSON());

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} aktif!`);
  client.user.setActivity(`mc.combatmc.net | /yardim`, { type: 0 });

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash komutlar yüklendi!');
  } catch (e) {
    console.error('❌ Komut yükleme hatası:', e);
  }
});

// ─── MESSAGE CREATE (küfür filtresi) ─────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Küfür filtresi
  if (containsBannedWord(message.content)) {
    try {
      await message.delete();
    } catch {}

    const count = addWarning(message.author.id, 'Otomatik: Küfür/hakaret');
    const reply = await message.channel.send({
      embeds: [makeEmbed(
        '🚫 Yasak Kelime Tespit Edildi',
        `${message.author}, **küfür ve hakaret sunucumuzda yasaktır!**\n> Toplam uyarı sayın: **${count}/3**\n> ${count >= 3 ? '⚠️ **3 uyarıya ulaştın! Moderatörler bilgilendirildi.**' : ''}`,
        CONFIG.COLOR_WARNING
      )]
    });

    if (count >= 3) {
      try {
        await message.member.timeout(10 * 60 * 1000, 'Otomatik: 3 uyarı - küfür');
      } catch {}
    }

    setTimeout(() => reply.delete().catch(() => {}), 8000);

    // Log
    if (CONFIG.LOG_CHANNEL_ID) {
      const logCh = message.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
      if (logCh) {
        logCh.send({ embeds: [makeEmbed('📋 Küfür Logu', `**Kullanıcı:** ${message.author.tag}\n**Kanal:** ${message.channel}\n**Mesaj:** ||${message.content.substring(0, 200)}||\n**Uyarı:** ${count}/3`, CONFIG.COLOR_WARNING)] });
      }
    }
  }
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) await handleSlash(interaction);
  else if (interaction.isButton()) await handleButton(interaction);
  else if (interaction.isModalSubmit()) await handleModal(interaction);
  else if (interaction.isStringSelectMenu()) await handleSelect(interaction);
});

// ─── SLASH HANDLER ────────────────────────────────────────────────────────────
async function handleSlash(i) {
  const { commandName } = i;

  // Cooldown (5sn genel)
  const cd = checkCooldown(i.user.id, commandName, 5);
  if (cd > 0) {
    return i.reply({ content: `⏳ Bu komutu tekrar kullanmak için **${cd} saniye** bekle!`, ephemeral: true });
  }

  try {
    switch (commandName) {

      // ── /sunucu ──────────────────────────────────────────────────────────
      case 'sunucu': {
        const embed = new EmbedBuilder()
          .setTitle('⚔️ CombatMC Sunucu Bilgileri')
          .setColor(CONFIG.COLOR_PRIMARY)
          .setDescription('Türkiye\'nin en iyi PvP Minecraft sunucusuna hoş geldin!')
          .addFields(
            { name: '🌐 IP Adresi', value: `\`${CONFIG.SERVER_IP}\``, inline: true },
            { name: '🎮 Sürüm', value: '`1.8 - 1.21`', inline: true },
            { name: '⚔️ Mod', value: '`PvP / KitPvP / Faction`', inline: true },
            { name: '🏆 Store', value: '[Mağaza](https://combatmc.net)', inline: true },
            { name: '📺 Discord', value: `[Davet Linki](https://discord.gg/combatmc)`, inline: true },
            { name: '📋 Kurallar', value: '`/kurallar` ile görebilirsin', inline: true },
          )
          .setImage('https://placehold.co/800x200/FF4444/FFFFFF?text=CombatMC+%E2%9A%94%EF%B8%8F')
          .setFooter({ text: `CombatMC • ${CONFIG.SERVER_IP}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('🎮 Sunucuya Gir').setStyle(ButtonStyle.Success).setCustomId('ip_kopyala'),
          new ButtonBuilder().setLabel('📋 Kurallar').setStyle(ButtonStyle.Primary).setCustomId('kurallar_btn'),
          new ButtonBuilder().setLabel('🎫 Destek').setStyle(ButtonStyle.Secondary).setCustomId('ticket_ac'),
        );

        await i.reply({ embeds: [embed], components: [row] });
        break;
      }

      // ── /ip ──────────────────────────────────────────────────────────────
      case 'ip': {
        await i.reply({
          embeds: [makeEmbed(
            '🌐 Sunucu IP Adresi',
            `**Java / Bedrock:** \`${CONFIG.SERVER_IP}\`\n\nSunucuya katılmak için IP adresini Minecraft'a yaz!`,
            CONFIG.COLOR_INFO
          )]
        });
        break;
      }

      // ── /kurallar ────────────────────────────────────────────────────────
      case 'kurallar': {
        const embed = new EmbedBuilder()
          .setTitle('📜 CombatMC Sunucu Kuralları')
          .setColor(CONFIG.COLOR_PRIMARY)
          .setDescription('Bu kurallara uymak **zorunludur**. Uymayan oyuncular ban/mute cezası alır.')
          .addFields(
            { name: '1️⃣ Saygı', value: 'Tüm oyunculara ve yetkililere saygılı olunacak. Küfür, hakaret kesinlikle yasaktır.' },
            { name: '2️⃣ Hile Yasak', value: 'KillAura, AutoClicker, Reach hacker, X-Ray vb. her türlü hile yasaktır. Kalıcı ban yenir.' },
            { name: '3️⃣ Reklam Yasak', value: 'Başka sunucuların reklamını yapmak yasaktır. Anında kalıcı ban uygulanır.' },
            { name: '4️⃣ Bug İstismarı', value: 'Oyun içi hataları (bug) kendi yararına kullanmak yasaktır. Yetkililere bildir.' },
            { name: '5️⃣ Hesap Güvenliği', value: 'Hesabın güvenliğinden sen sorumlusun. "Hesabım hacklendi" geçerli bir özür değildir.' },
            { name: '6️⃣ Yetkili Kararı', value: 'Yetkili kararlarına itiraz etmek için ticket aç. Kanalda tartışma yasaktır.' },
            { name: '7️⃣ Spam', value: 'Aynı mesajı tekrar tekrar atmak, caps lock kullanmak yasaktır.' },
            { name: '8️⃣ İtiraz', value: 'Haksız ceza aldığını düşünüyorsan ticket sistemi ile başvur.' },
          )
          .setFooter({ text: `CombatMC • Kuralları çiğneyenler cezalandırılır!` })
          .setTimestamp();

        await i.reply({ embeds: [embed] });
        break;
      }

      // ── /yardim ──────────────────────────────────────────────────────────
      case 'yardim': {
        const embed = new EmbedBuilder()
          .setTitle('❓ CombatMC Bot Komutları')
          .setColor(CONFIG.COLOR_INFO)
          .addFields(
            {
              name: '🎮 Sunucu Komutları', value:
                '`/sunucu` - Sunucu bilgileri\n`/ip` - IP adresi\n`/kurallar` - Kurallar\n`/rank <ad>` - Oyuncu rank\n`/sikayet` - Oyuncu şikayet'
            },
            {
              name: '🎫 Destek', value:
                '`/ticket` - Destek talebi\n`/basvuru` - Yetkili başvurusu'
            },
            {
              name: '🛡️ Moderasyon', value:
                '`/warn` `/uyarilar` `/uyarisil`\n`/mute` `/unmute`\n`/kick` `/ban` `/unban`\n`/temizle` `/yavaslat`'
            },
            {
              name: '🎉 Eğlence & Araçlar', value:
                '`/anket` - Anket oluştur\n`/zar` - Zar at\n`/kullanici` - Kullanıcı bilgisi\n`/sunucuinfo` - Sunucu istatistikleri\n`/duyuru` - Duyuru gönder\n`/embedgonder` - Özel embed\n`/ping` - Bot gecikmesi'
            },
          )
          .setFooter({ text: `CombatMC • ${CONFIG.SERVER_IP}` })
          .setTimestamp();

        await i.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      // ── /ticket ──────────────────────────────────────────────────────────
      case 'ticket': {
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('ticket_kategori')
            .setPlaceholder('Talep kategorisi seç...')
            .addOptions([
              { label: '⚔️ Hile Şikayeti', value: 'hile', description: 'Hileci oyuncu bildirimi' },
              { label: '🚫 Ban İtirazı', value: 'ban_itiraz', description: 'Haksız ban itirazı' },
              { label: '🔇 Mute İtirazı', value: 'mute_itiraz', description: 'Haksız mute itirazı' },
              { label: '💰 Ödeme Sorunu', value: 'odeme', description: 'Satın alma / VIP sorunları' },
              { label: '🐛 Bug Bildirimi', value: 'bug', description: 'Oyun içi hata bildirimi' },
              { label: '🤝 Ortak Teklif', value: 'ortak', description: 'İş birliği / sponsor teklifleri' },
              { label: '❓ Diğer', value: 'diger', description: 'Diğer konular' },
            ])
        );

        await i.reply({
          embeds: [makeEmbed(
            '🎫 Destek Talebi Oluştur',
            'Aşağıdan talep kategorini seç. Yetkili ekibimiz en kısa sürede sana yardımcı olacak!\n\n> ⚠️ Gereksiz ticket açmak ceza sebebidir.',
            CONFIG.COLOR_INFO
          )],
          components: [row],
          ephemeral: true
        });
        break;
      }

      // ── /ticketkapat ─────────────────────────────────────────────────────
      case 'ticketkapat': {
        if (!i.channel.name.startsWith('ticket-')) {
          return i.reply({ content: '❌ Bu kanal bir ticket kanalı değil!', ephemeral: true });
        }
        await i.reply({
          embeds: [makeEmbed('🔒 Ticket Kapatılıyor', 'Bu ticket 5 saniye içinde kapatılacak...', CONFIG.COLOR_WARNING)]
        });
        setTimeout(async () => {
          await i.channel.delete('Ticket kapatıldı').catch(() => {});
        }, 5000);
        break;
      }

      // ── /warn ────────────────────────────────────────────────────────────
      case 'warn': {
        const target = i.options.getUser('kullanici');
        const reason = i.options.getString('sebep');
        const count = addWarning(target.id, reason);

        await i.reply({
          embeds: [makeEmbed(
            '⚠️ Uyarı Verildi',
            `**Kullanıcı:** ${target}\n**Sebep:** ${reason}\n**Uyarı sayısı:** ${count}/3\n**Yetkili:** ${i.user}`,
            CONFIG.COLOR_WARNING
          )]
        });

        try {
          await target.send({ embeds: [makeEmbed('⚠️ Uyarı Aldın!', `**${i.guild.name}** sunucusunda uyarı aldın!\n**Sebep:** ${reason}\n**Uyarı sayısı:** ${count}/3`, CONFIG.COLOR_WARNING)] });
        } catch {}

        if (count >= 3) {
          const member = await i.guild.members.fetch(target.id).catch(() => null);
          if (member) await member.timeout(30 * 60 * 1000, '3 uyarı limitine ulaşıldı').catch(() => {});
          await i.followUp({ embeds: [makeEmbed('🔇 Otomatik Mute', `${target} 3 uyarıya ulaştığı için **30 dakika** susturuldu!`, CONFIG.COLOR_WARNING)] });
        }
        break;
      }

      // ── /uyarilar ────────────────────────────────────────────────────────
      case 'uyarilar': {
        const target = i.options.getUser('kullanici');
        const list = getWarnings(target.id);

        if (list.length === 0) {
          return i.reply({ embeds: [makeEmbed('✅ Uyarı Yok', `${target} kullanıcısının hiç uyarısı yok!`, CONFIG.COLOR_SUCCESS)] });
        }

        const listText = list.map((w, idx) => `**${idx + 1}.** ${w.reason} — <t:${Math.floor(w.date.getTime() / 1000)}:R>`).join('\n');
        await i.reply({
          embeds: [makeEmbed(
            `⚠️ ${target.username} - Uyarılar (${list.length}/3)`,
            listText,
            CONFIG.COLOR_WARNING
          )]
        });
        break;
      }

      // ── /uyarisil ────────────────────────────────────────────────────────
      case 'uyarisil': {
        const target = i.options.getUser('kullanici');
        clearWarnings(target.id);
        await i.reply({ embeds: [makeEmbed('✅ Uyarılar Silindi', `${target} kullanıcısının tüm uyarıları temizlendi.`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── /mute ────────────────────────────────────────────────────────────
      case 'mute': {
        const target = i.options.getMember('kullanici');
        const minutes = i.options.getInteger('sure');
        const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';

        if (!target) return i.reply({ content: '❌ Kullanıcı bulunamadı!', ephemeral: true });
        if (target.id === i.user.id) return i.reply({ content: '❌ Kendini mute alamazsın!', ephemeral: true });

        await target.timeout(minutes * 60 * 1000, reason);
        await i.reply({
          embeds: [makeEmbed(
            '🔇 Kullanıcı Susturuldu',
            `**Kullanıcı:** ${target}\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}\n**Yetkili:** ${i.user}`,
            CONFIG.COLOR_WARNING
          )]
        });

        try {
          await target.user.send({ embeds: [makeEmbed('🔇 Susturuldun!', `**${i.guild.name}** sunucusunda ${minutes} dakika susturuldun.\n**Sebep:** ${reason}`, CONFIG.COLOR_WARNING)] });
        } catch {}
        break;
      }

      // ── /unmute ──────────────────────────────────────────────────────────
      case 'unmute': {
        const target = i.options.getMember('kullanici');
        if (!target) return i.reply({ content: '❌ Kullanıcı bulunamadı!', ephemeral: true });
        await target.timeout(null);
        await i.reply({ embeds: [makeEmbed('🔊 Susturma Kaldırıldı', `${target} kullanıcısının susturması kaldırıldı.`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── /kick ────────────────────────────────────────────────────────────
      case 'kick': {
        const target = i.options.getMember('kullanici');
        const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';
        if (!target) return i.reply({ content: '❌ Kullanıcı bulunamadı!', ephemeral: true });
        await target.kick(reason);
        await i.reply({
          embeds: [makeEmbed(
            '👢 Kullanıcı Atıldı',
            `**Kullanıcı:** ${target.user.tag}\n**Sebep:** ${reason}\n**Yetkili:** ${i.user}`,
            CONFIG.COLOR_WARNING
          )]
        });
        break;
      }

      // ── /ban ─────────────────────────────────────────────────────────────
      case 'ban': {
        const target = i.options.getMember('kullanici');
        const reason = i.options.getString('sebep') || 'Sebep belirtilmedi';
        const days = i.options.getInteger('silme') || 0;
        if (!target) return i.reply({ content: '❌ Kullanıcı bulunamadı!', ephemeral: true });

        try {
          await target.user.send({ embeds: [makeEmbed('🔨 Yasaklandın!', `**${i.guild.name}** sunucusundan yasaklandın.\n**Sebep:** ${reason}`, CONFIG.COLOR_PRIMARY)] });
        } catch {}

        await target.ban({ deleteMessageDays: days, reason });
        await i.reply({
          embeds: [makeEmbed(
            '🔨 Kullanıcı Yasaklandı',
            `**Kullanıcı:** ${target.user.tag}\n**Sebep:** ${reason}\n**Mesaj silme:** ${days} gün\n**Yetkili:** ${i.user}`,
            CONFIG.COLOR_PRIMARY
          )]
        });
        break;
      }

      // ── /unban ───────────────────────────────────────────────────────────
      case 'unban': {
        const id = i.options.getString('id');
        await i.guild.members.unban(id).catch(() => {});
        await i.reply({ embeds: [makeEmbed('✅ Yasak Kaldırıldı', `ID: \`${id}\` kullanıcısının yasağı kaldırıldı.`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── /temizle ─────────────────────────────────────────────────────────
      case 'temizle': {
        const amount = i.options.getInteger('adet');
        await i.deferReply({ ephemeral: true });
        const deleted = await i.channel.bulkDelete(amount, true);
        await i.editReply({ content: `✅ **${deleted.size}** mesaj silindi.` });
        break;
      }

      // ── /kullanici ───────────────────────────────────────────────────────
      case 'kullanici': {
        const target = i.options.getMember('kullanici') || i.member;
        const user = target.user;
        const roles = target.roles.cache.filter(r => r.id !== i.guild.id).map(r => r.toString()).join(', ') || 'Yok';

        const embed = new EmbedBuilder()
          .setTitle(`👤 ${user.username} Bilgileri`)
          .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(target.displayHexColor || CONFIG.COLOR_INFO)
          .addFields(
            { name: '🏷️ Kullanıcı Adı', value: user.tag, inline: true },
            { name: '🆔 ID', value: user.id, inline: true },
            { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '📥 Sunucuya Katılma', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: '🎭 Roller', value: roles.length > 1024 ? roles.substring(0, 1020) + '...' : roles },
            { name: '⚠️ Uyarılar', value: `${getWarnings(user.id).length}/3`, inline: true },
          )
          .setFooter({ text: `CombatMC • ${CONFIG.SERVER_IP}` })
          .setTimestamp();

        await i.reply({ embeds: [embed] });
        break;
      }

      // ── /sunucuinfo ──────────────────────────────────────────────────────
      case 'sunucuinfo': {
        const g = i.guild;
        const embed = new EmbedBuilder()
          .setTitle(`🏰 ${g.name} Sunucu Bilgileri`)
          .setThumbnail(g.iconURL({ dynamic: true }))
          .setColor(CONFIG.COLOR_INFO)
          .addFields(
            { name: '👑 Kurucu', value: `<@${g.ownerId}>`, inline: true },
            { name: '👥 Üye Sayısı', value: `${g.memberCount}`, inline: true },
            { name: '📅 Oluşturulma', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '💬 Kanal Sayısı', value: `${g.channels.cache.size}`, inline: true },
            { name: '🎭 Rol Sayısı', value: `${g.roles.cache.size}`, inline: true },
            { name: '😀 Emoji Sayısı', value: `${g.emojis.cache.size}`, inline: true },
            { name: '🌐 Sunucu ID', value: g.id, inline: true },
            { name: '🔒 Doğrulama', value: g.verificationLevel.toString(), inline: true },
          )
          .setFooter({ text: `CombatMC • ${CONFIG.SERVER_IP}` })
          .setTimestamp();

        await i.reply({ embeds: [embed] });
        break;
      }

      // ── /anket ───────────────────────────────────────────────────────────
      case 'anket': {
        const soru = i.options.getString('soru');
        const opts = [
          i.options.getString('secenek1'),
          i.options.getString('secenek2'),
          i.options.getString('secenek3'),
          i.options.getString('secenek4'),
        ].filter(Boolean);

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        const optText = opts.map((o, idx) => `${emojis[idx]} ${o}`).join('\n');

        const msg = await i.channel.send({
          embeds: [makeEmbed(`📊 ANKET: ${soru}`, optText + '\n\n*Aşağıdaki emojilerle oy kullanın!*', CONFIG.COLOR_INFO)]
        });

        for (let idx = 0; idx < opts.length; idx++) {
          await msg.react(emojis[idx]);
        }

        await i.reply({ content: '✅ Anket oluşturuldu!', ephemeral: true });
        break;
      }

      // ── /duyuru ──────────────────────────────────────────────────────────
      case 'duyuru': {
        const msg = i.options.getString('mesaj');
        await i.channel.send({
          content: '@everyone',
          embeds: [makeEmbed('📢 DUYURU', msg, CONFIG.COLOR_PRIMARY)]
        });
        await i.reply({ content: '✅ Duyuru gönderildi!', ephemeral: true });
        break;
      }

      // ── /zar ─────────────────────────────────────────────────────────────
      case 'zar': {
        const sides = i.options.getInteger('yuz') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await i.reply({
          embeds: [makeEmbed(
            '🎲 Zar Atıldı!',
            `${i.user} **${sides} yüzlü** zar attı ve **${result}** geldi!`,
            CONFIG.COLOR_SUCCESS
          )]
        });
        break;
      }

      // ── /ping ────────────────────────────────────────────────────────────
      case 'ping': {
        const sent = await i.reply({ content: 'Ölçülüyor...', fetchReply: true });
        await i.editReply({
          content: '',
          embeds: [makeEmbed(
            '🏓 Pong!',
            `**Bot Gecikmesi:** ${sent.createdTimestamp - i.createdTimestamp}ms\n**API Gecikmesi:** ${Math.round(client.ws.ping)}ms`,
            CONFIG.COLOR_SUCCESS
          )]
        });
        break;
      }

      // ── /rank ────────────────────────────────────────────────────────────
      case 'rank': {
        const ign = i.options.getString('kullaniciadi');
        const ranks = ['Oyuncu', 'Bronz', 'Gümüş', 'Altın', 'Elmas', 'Master', 'Grandmaster', 'Efsane'];
        const rank = ranks[Math.floor(Math.random() * ranks.length)];
        const xp = Math.floor(Math.random() * 50000);

        await i.reply({
          embeds: [makeEmbed(
            `⚔️ ${ign} - Rank Bilgisi`,
            `**🏆 Rank:** ${rank}\n**⭐ XP:** ${xp.toLocaleString()}\n**🌐 Sunucu:** ${CONFIG.SERVER_IP}\n\n*Güncel rank için oyuna gir ve \`/rank\` yaz!*`,
            CONFIG.COLOR_PRIMARY
          )]
        });
        break;
      }

      // ── /basvuru ─────────────────────────────────────────────────────────
      case 'basvuru': {
        const modal = new ModalBuilder()
          .setCustomId('basvuru_modal')
          .setTitle('⚔️ CombatMC Yetkili Başvurusu');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ign').setLabel('Minecraft Kullanıcı Adın').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('yas').setLabel('Yaşın').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('tecrube').setLabel('Moderasyon Tecrüben').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Daha önce hangi sunucularda yetkili oldun?')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('neden').setLabel('Neden Yetkili Olmak İstiyorsun?').setStyle(TextInputStyle.Paragraph).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('gunluk').setLabel('Günlük Kaç Saat Aktif Olabilirsin?').setStyle(TextInputStyle.Short).setRequired(true)
          ),
        );

        await i.showModal(modal);
        break;
      }

      // ── /sikayet ─────────────────────────────────────────────────────────
      case 'sikayet': {
        const oyuncu = i.options.getString('oyuncu');
        const sebep = i.options.getString('sebep');

        const guild = i.guild;
        const channelName = `sikayet-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        const channel = await guild.channels.create({
          name: channelName,
          type: 0,
          parent: CONFIG.TICKET_CATEGORY_ID,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ...(CONFIG.MOD_ROLE_ID ? [{ id: CONFIG.MOD_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
          ]
        });

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Kapat').setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: CONFIG.MOD_ROLE_ID ? `<@&${CONFIG.MOD_ROLE_ID}>` : '',
          embeds: [makeEmbed(
            '🚨 Oyuncu Şikayeti',
            `**Şikayet Eden:** ${i.user}\n**Şikayet Edilen Oyuncu:** \`${oyuncu}\`\n**Sebep:** ${sebep}\n\nLütfen kanıt (ekran görüntüsü/video) paylaşın!`,
            CONFIG.COLOR_PRIMARY
          )],
          components: [closeRow]
        });

        await i.reply({ content: `✅ Şikayet kanalın oluşturuldu: ${channel}`, ephemeral: true });
        break;
      }

      // ── /embedgonder ─────────────────────────────────────────────────────
      case 'embedgonder': {
        const baslik = i.options.getString('baslik');
        const icerik = i.options.getString('icerik');
        const renk = i.options.getString('renk');
        const color = renk ? parseInt(renk.replace('#', ''), 16) : CONFIG.COLOR_PRIMARY;

        await i.channel.send({
          embeds: [makeEmbed(baslik, icerik, isNaN(color) ? CONFIG.COLOR_PRIMARY : color)]
        });
        await i.reply({ content: '✅ Embed gönderildi!', ephemeral: true });
        break;
      }

      // ── /youtube ─────────────────────────────────────────────────────────
      case 'youtube': {
        const link = i.options.getString('link');
        if (!link.includes('youtube.com') && !link.includes('youtu.be')) {
          return i.reply({ content: '❌ Geçerli bir YouTube linki değil!', ephemeral: true });
        }
        await i.reply({
          embeds: [makeEmbed('📺 YouTube Video', `${i.user} bir video paylaştı!\n${link}`, CONFIG.COLOR_PRIMARY)]
        });
        break;
      }

      // ── /yavaslat ────────────────────────────────────────────────────────
      case 'yavaslat': {
        const saniye = i.options.getInteger('saniye');
        await i.channel.setRateLimitPerUser(saniye);
        if (saniye === 0) {
          await i.reply({ embeds: [makeEmbed('✅ Yavaş Mod Kapatıldı', 'Bu kanalda yavaş mod kapatıldı.', CONFIG.COLOR_SUCCESS)] });
        } else {
          await i.reply({ embeds: [makeEmbed('🐌 Yavaş Mod Açıldı', `Bu kanalda yavaş mod **${saniye} saniye** olarak ayarlandı.`, CONFIG.COLOR_WARNING)] });
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[HATA] /${commandName}:`, err);
    const errorEmbed = makeEmbed('❌ Hata', 'Bir hata oluştu! Lütfen tekrar dene.', CONFIG.COLOR_WARNING);
    if (i.deferred || i.replied) {
      await i.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
    } else {
      await i.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
    }
  }
}

// ─── BUTTON HANDLER ───────────────────────────────────────────────────────────
async function handleButton(i) {
  switch (i.customId) {
    case 'ip_kopyala': {
      await i.reply({ content: `🌐 Sunucu IP: \`${CONFIG.SERVER_IP}\`\nJava & Bedrock ile bağlanabilirsin!`, ephemeral: true });
      break;
    }
    case 'kurallar_btn': {
      await i.reply({
        embeds: [makeEmbed('📜 Kural Özeti', '1. Saygılı ol\n2. Hile kullanma\n3. Reklam yapma\n4. Bug istismarı yok\n5. Yetkililere saygı\n\nDetaylar için: `/kurallar`', CONFIG.COLOR_INFO)],
        ephemeral: true
      });
      break;
    }
    case 'ticket_ac': {
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_kategori')
          .setPlaceholder('Talep kategorisi seç...')
          .addOptions([
            { label: '⚔️ Hile Şikayeti', value: 'hile' },
            { label: '🚫 Ban İtirazı', value: 'ban_itiraz' },
            { label: '🔇 Mute İtirazı', value: 'mute_itiraz' },
            { label: '💰 Ödeme Sorunu', value: 'odeme' },
            { label: '🐛 Bug Bildirimi', value: 'bug' },
            { label: '❓ Diğer', value: 'diger' },
          ])
      );
      await i.reply({ embeds: [makeEmbed('🎫 Ticket', 'Kategori seç:', CONFIG.COLOR_INFO)], components: [row], ephemeral: true });
      break;
    }
    case 'ticket_kapat': {
      if (!i.channel.name.startsWith('ticket-') && !i.channel.name.startsWith('sikayet-') && !i.channel.name.startsWith('basvuru-')) {
        return i.reply({ content: '❌ Bu kanal bir ticket değil!', ephemeral: true });
      }
      await i.reply({ embeds: [makeEmbed('🔒 Kapatılıyor', '5 saniye içinde kanal silinecek...', CONFIG.COLOR_WARNING)] });
      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
      break;
    }
  }
}

// ─── SELECT HANDLER ───────────────────────────────────────────────────────────
async function handleSelect(i) {
  if (i.customId === 'ticket_kategori') {
    const value = i.values[0];
    const labels = {
      hile: '⚔️ Hile Şikayeti',
      ban_itiraz: '🚫 Ban İtirazı',
      mute_itiraz: '🔇 Mute İtirazı',
      odeme: '💰 Ödeme Sorunu',
      bug: '🐛 Bug Bildirimi',
      ortak: '🤝 Ortak Teklif',
      diger: '❓ Diğer',
    };

    const guild = i.guild;
    const channelName = `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Mevcut ticket kontrolü
    const existing = guild.channels.cache.find(c => c.name === channelName);
    if (existing) {
      return i.reply({ content: `❌ Zaten açık bir ticketin var: ${existing}`, ephemeral: true });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: 0,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        ...(CONFIG.MOD_ROLE_ID ? [{ id: CONFIG.MOD_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }] : []),
      ]
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Ticketi Kapat').setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `${i.user}${CONFIG.MOD_ROLE_ID ? ` <@&${CONFIG.MOD_ROLE_ID}>` : ''}`,
      embeds: [makeEmbed(
        `🎫 ${labels[value]}`,
        `**Açan:** ${i.user}\n**Kategori:** ${labels[value]}\n**Tarih:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nLütfen sorununuzu **detaylı** açıklayın. Yetkili ekibimiz en kısa sürede yardımcı olacak!\n\n> ⚠️ Gereksiz ticket açmak ceza sebebidir.`,
        CONFIG.COLOR_INFO
      )],
      components: [closeRow]
    });

    await i.reply({ content: `✅ Ticketin oluşturuldu: ${channel}`, ephemeral: true });
  }
}

// ─── MODAL HANDLER ────────────────────────────────────────────────────────────
async function handleModal(i) {
  if (i.customId === 'basvuru_modal') {
    const ign = i.fields.getTextInputValue('ign');
    const yas = i.fields.getTextInputValue('yas');
    const tecrube = i.fields.getTextInputValue('tecrube');
    const neden = i.fields.getTextInputValue('neden');
    const gunluk = i.fields.getTextInputValue('gunluk');

    const guild = i.guild;
    const channelName = `basvuru-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

    const channel = await guild.channels.create({
      name: channelName,
      type: 0,
      parent: CONFIG.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
        ...(CONFIG.ADMIN_ROLE_ID ? [{ id: CONFIG.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : []),
      ]
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Kapat').setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: CONFIG.ADMIN_ROLE_ID ? `<@&${CONFIG.ADMIN_ROLE_ID}>` : '',
      embeds: [new EmbedBuilder()
        .setTitle('📋 Yetkili Başvurusu')
        .setColor(CONFIG.COLOR_PRIMARY)
        .setThumbnail(i.user.displayAvatarURL())
        .addFields(
          { name: '👤 Discord', value: i.user.toString(), inline: true },
          { name: '⛏️ IGN', value: ign, inline: true },
          { name: '🎂 Yaş', value: yas, inline: true },
          { name: '⏰ Günlük Aktiflik', value: `${gunluk} saat`, inline: true },
          { name: '📚 Tecrübe', value: tecrube },
          { name: '💬 Neden Yetkili?', value: neden },
        )
        .setFooter({ text: `CombatMC • ${CONFIG.SERVER_IP}` })
        .setTimestamp()
      ],
      components: [closeRow]
    });

    await i.reply({ content: `✅ Başvurun alındı! ${channel} kanalından takip edebilirsin.`, ephemeral: true });
  }
}

// ─── MEMBER JOIN ──────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  // Hoş geldin mesajı - bir kanal ID'si ayarlanmışsa
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
  if (!welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('⚔️ CombatMC\'ye Hoş Geldin!')
    .setDescription(`${member} sunucumuza katıldı!\n\n**🌐 Sunucu IP:** \`${CONFIG.SERVER_IP}\`\n**📜 Kurallar:** \`/kurallar\` yazarak okuyabilirsin\n**🎫 Destek:** \`/ticket\` ile yetkililere ulaşabilirsin`)
    .setColor(CONFIG.COLOR_SUCCESS)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `${member.guild.name} • Üye #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
client.on('error', err => console.error('Discord Client Error:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
