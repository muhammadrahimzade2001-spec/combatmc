const {
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, Collection,
} = require('discord.js');

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
  PREFIX: '!',
  COLOR_PRIMARY: 0xFF4444,
  COLOR_SUCCESS: 0x00FF88,
  COLOR_WARNING: 0xFFAA00,
  COLOR_INFO: 0x4488FF,
  COLOR_DARK: 0x1A1A2E,
  COLOR_GOLD: 0xFFD700,

  // Sunucu modları
  MODES: {
    boxpvp: {
      name: '⚔️ BoxPvP',
      ip: 'boxpvp.combatmc.net',
      version: '1.8 - 1.21',
      desc: 'Kutularda geçen hızlı tempolu PvP modu! Kit seç, savaş, kazan.',
      features: ['🎯 Kit sistemi', '🏆 Sıralama tablosu', '💎 VIP kitler', '⚡ Hızlı respawn'],
      color: 0xFF4444,
    },
    boxmining: {
      name: '⛏️ BoxMining',
      ip: 'boxmining.combatmc.net',
      version: '1.16.5',
      desc: 'Madencilik ve hayatta kalma odaklı mod. Kaynak topla, üs kur, rakiplerini ez!',
      features: ['🪨 Özel madencilik sistemi', '🏠 Üs kurma', '💰 Ekonomi sistemi', '🤝 Takım desteği'],
      color: 0xA0522D,
    },
    mod: {
      name: '🗡️ Mod (Modded)',
      ip: 'mod.combatmc.net',
      version: '1.16.5',
      desc: 'Forge modları ile güçlendirilmiş özel mod deneyimi!',
      features: ['⚗️ Özel modlar', '🔧 Forge 1.16.5', '🌍 Özel dünyalar', '🧪 Yeni itemlar'],
      color: 0x8A2BE2,
      modpack: 'CombatMC Modpack v1.0 — #modpack kanalından indir!',
    },
  },

  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || null,
  MOD_ROLE_ID: process.env.MOD_ROLE_ID || null,
  ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID || null,
  SUPPORT_CHANNEL_ID: process.env.SUPPORT_CHANNEL_ID || null,
};

// ─── KÜFÜR LİSTESİ ────────────────────────────────────────────────────────────
const BANNED_WORDS = [
  'orospu', 'oç', 'göt', 'sik', 'amk', 'amına', 'bok', 'yarrak', 'piç',
  'ibne', 'götveren', 'orospu çocuğu', 'kaltak', 'fahişe',
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'nigga', 'nigger',
  'bastard', 'motherfucker', 'asshole', 'cunt',
];

function containsBannedWord(text) {
  const lower = text.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/gi, '');
  return BANNED_WORDS.some(w => lower.includes(w));
}

// ─── UYARI SİSTEMİ ────────────────────────────────────────────────────────────
const warnings = new Map();

function addWarning(userId, reason) {
  if (!warnings.has(userId)) warnings.set(userId, []);
  warnings.get(userId).push({ reason, date: new Date() });
  return warnings.get(userId).length;
}
function getWarnings(userId) { return warnings.get(userId) || []; }
function clearWarnings(userId) { warnings.delete(userId); }

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
  if (footer) e.setFooter({ text: `${CONFIG.SERVER_NAME}` });
  return e;
}

// ─── TICKET GUI (destek kanalına gönderilen büyük menü) ───────────────────────
async function sendTicketGUI(channel, guild) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 CombatMC Destek Sistemi')
    .setDescription(
      '**Aşağıdaki butonlardan birini seçerek destek talebi oluşturabilirsin!**\n\n' +
      '⚔️ **Hile Şikayeti** — Hileci oyuncu bildir\n' +
      '🚫 **Ban İtirazı** — Haksız ban itirazı\n' +
      '🔇 **Mute İtirazı** — Haksız mute itirazı\n' +
      '💰 **Ödeme Sorunu** — VIP / mağaza sorunları\n' +
      '🐛 **Bug Bildirimi** — Oyun içi hata bildir\n' +
      '📋 **Yetkili Başvurusu** — Ekibimize katıl\n' +
      '❓ **Diğer** — Diğer konular\n\n' +
      '> ⚠️ Gereksiz ticket açmak **ceza sebebidir!**'
    )
    .setColor(CONFIG.COLOR_INFO)
    .setFooter({ text: `${CONFIG.SERVER_NAME} • Destek ekibimiz en kısa sürede yardımcı olacak!` })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('t_hile').setLabel('Hile Şikayeti').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('t_ban').setLabel('Ban İtirazı').setEmoji('🚫').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('t_mute').setLabel('Mute İtirazı').setEmoji('🔇').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('t_odeme').setLabel('Ödeme Sorunu').setEmoji('💰').setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('t_bug').setLabel('Bug Bildirimi').setEmoji('🐛').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('t_basvuru').setLabel('Yetkili Başvurusu').setEmoji('📋').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('t_diger').setLabel('Diğer').setEmoji('❓').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [embed], components: [row1, row2] });
}

// ─── TICKET OLUŞTURUCU ────────────────────────────────────────────────────────
const TICKET_LABELS = {
  t_hile:     '⚔️ Hile Şikayeti',
  t_ban:      '🚫 Ban İtirazı',
  t_mute:     '🔇 Mute İtirazı',
  t_odeme:    '💰 Ödeme Sorunu',
  t_bug:      '🐛 Bug Bildirimi',
  t_basvuru:  '📋 Yetkili Başvurusu',
  t_diger:    '❓ Diğer',
};

async function createTicket(i, type) {
  const guild = i.guild;
  const channelName = `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

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
      `🎫 ${TICKET_LABELS[type]}`,
      `**Açan:** ${i.user}\n**Kategori:** ${TICKET_LABELS[type]}\n**Tarih:** <t:${Math.floor(Date.now() / 1000)}:F>\n\nSorununuzu **detaylı** açıklayın. Ekibimiz en kısa sürede yardımcı olacak!\n\n> ⚠️ Gereksiz ticket açmak ceza sebebidir.`,
      CONFIG.COLOR_INFO
    )],
    components: [closeRow]
  });

  await i.reply({ content: `✅ Ticketin oluşturuldu: ${channel}`, ephemeral: true });
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} aktif!`);
  client.user.setActivity(`CombatMC | !yardim`, { type: 0 });
  console.log(`🤖 Prefix: ${CONFIG.PREFIX}`);
});

// ─── MESSAGE CREATE ───────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // Küfür filtresi
  if (containsBannedWord(message.content)) {
    try { await message.delete(); } catch {}
    const count = addWarning(message.author.id, 'Otomatik: Küfür/hakaret');
    const reply = await message.channel.send({
      embeds: [makeEmbed(
        '🚫 Yasak Kelime!',
        `${message.author}, küfür ve hakaret **yasaktır!**\n> Uyarı: **${count}/3**\n${count >= 3 ? '⚠️ **3 uyarıya ulaştın! Moderatörler bilgilendirildi.**' : ''}`,
        CONFIG.COLOR_WARNING
      )]
    });
    if (count >= 3) {
      try { await message.member.timeout(10 * 60 * 1000, 'Otomatik: 3 uyarı - küfür'); } catch {}
    }
    setTimeout(() => reply.delete().catch(() => {}), 8000);

    if (CONFIG.LOG_CHANNEL_ID) {
      const logCh = message.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
      if (logCh) logCh.send({ embeds: [makeEmbed('📋 Küfür Logu', `**Kullanıcı:** ${message.author.tag}\n**Kanal:** ${message.channel}\n**Mesaj:** ||${message.content.substring(0, 200)}||\n**Uyarı:** ${count}/3`, CONFIG.COLOR_WARNING)] });
    }
    return;
  }

  // Prefix kontrolü
  if (!message.content.startsWith(CONFIG.PREFIX)) return;

  const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Cooldown (3sn)
  const cd = checkCooldown(message.author.id, command, 3);
  if (cd > 0) {
    const m = await message.reply(`⏳ **${cd} saniye** bekle!`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  try {
    switch (command) {

      // ── !sunucu ────────────────────────────────────────────────────────────
      case 'sunucu': {
        const embed = new EmbedBuilder()
          .setTitle('⚔️ CombatMC Sunucu Bilgileri')
          .setColor(CONFIG.COLOR_PRIMARY)
          .setDescription('Türkiye\'nin en iyi PvP Minecraft sunucusuna hoş geldin!\n\nAşağıdan oynamak istediğin modu seç:')
          .addFields(
            {
              name: '⚔️ BoxPvP',
              value: `\`${CONFIG.MODES.boxpvp.ip}\`\n📌 Sürüm: \`${CONFIG.MODES.boxpvp.version}\`\n${CONFIG.MODES.boxpvp.features.join(' · ')}`,
              inline: false
            },
            {
              name: '⛏️ BoxMining',
              value: `\`${CONFIG.MODES.boxmining.ip}\`\n📌 Sürüm: \`${CONFIG.MODES.boxmining.version}\`\n${CONFIG.MODES.boxmining.features.join(' · ')}`,
              inline: false
            },
            {
              name: '🗡️ Mod (Modded)',
              value: `\`${CONFIG.MODES.mod.ip}\`\n📌 Sürüm: \`${CONFIG.MODES.mod.version}\`\n${CONFIG.MODES.mod.features.join(' · ')}\n📦 ${CONFIG.MODES.mod.modpack}`,
              inline: false
            },
          )
          .setFooter({ text: 'CombatMC • !boxpvp | !boxmining | !mod' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('⚔️ BoxPvP').setStyle(ButtonStyle.Danger).setCustomId('info_boxpvp'),
          new ButtonBuilder().setLabel('⛏️ BoxMining').setStyle(ButtonStyle.Primary).setCustomId('info_boxmining'),
          new ButtonBuilder().setLabel('🗡️ Mod').setStyle(ButtonStyle.Secondary).setCustomId('info_mod'),
          new ButtonBuilder().setLabel('🎫 Destek').setStyle(ButtonStyle.Success).setCustomId('t_diger'),
        );

        await message.reply({ embeds: [embed], components: [row] });
        break;
      }

      // ── !boxpvp ───────────────────────────────────────────────────────────
      case 'boxpvp': {
        const m = CONFIG.MODES.boxpvp;
        const embed = new EmbedBuilder()
          .setTitle(m.name)
          .setDescription(m.desc)
          .setColor(m.color)
          .addFields(
            { name: '🌐 IP Adresi', value: `\`${m.ip}\``, inline: true },
            { name: '🎮 Sürüm', value: `\`${m.version}\``, inline: true },
            { name: '✨ Özellikler', value: m.features.join('\n'), inline: false },
          )
          .setFooter({ text: 'CombatMC BoxPvP' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !boxmining ────────────────────────────────────────────────────────
      case 'boxmining': {
        const m = CONFIG.MODES.boxmining;
        const embed = new EmbedBuilder()
          .setTitle(m.name)
          .setDescription(m.desc)
          .setColor(m.color)
          .addFields(
            { name: '🌐 IP Adresi', value: `\`${m.ip}\``, inline: true },
            { name: '🎮 Sürüm', value: `\`${m.version}\``, inline: true },
            { name: '✨ Özellikler', value: m.features.join('\n'), inline: false },
          )
          .setFooter({ text: 'CombatMC BoxMining' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !mod ──────────────────────────────────────────────────────────────
      case 'mod': {
        const m = CONFIG.MODES.mod;
        const embed = new EmbedBuilder()
          .setTitle(m.name)
          .setDescription(m.desc)
          .setColor(m.color)
          .addFields(
            { name: '🌐 IP Adresi', value: `\`${m.ip}\``, inline: true },
            { name: '🎮 Sürüm', value: `\`${m.version}\``, inline: true },
            { name: '📦 Modpack', value: m.modpack, inline: false },
            { name: '✨ Özellikler', value: m.features.join('\n'), inline: false },
          )
          .setFooter({ text: 'CombatMC Mod' })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !ip ───────────────────────────────────────────────────────────────
      case 'ip': {
        await message.reply({
          embeds: [new EmbedBuilder()
            .setTitle('🌐 CombatMC IP Adresleri')
            .setColor(CONFIG.COLOR_INFO)
            .addFields(
              { name: '⚔️ BoxPvP', value: `\`${CONFIG.MODES.boxpvp.ip}\` — ${CONFIG.MODES.boxpvp.version}`, inline: false },
              { name: '⛏️ BoxMining', value: `\`${CONFIG.MODES.boxmining.ip}\` — ${CONFIG.MODES.boxmining.version}`, inline: false },
              { name: '🗡️ Mod', value: `\`${CONFIG.MODES.mod.ip}\` — ${CONFIG.MODES.mod.version}`, inline: false },
            )
            .setTimestamp()
          ]
        });
        break;
      }

      // ── !kurallar ─────────────────────────────────────────────────────────
      case 'kurallar': {
        const embed = new EmbedBuilder()
          .setTitle('📜 CombatMC Sunucu Kuralları')
          .setColor(CONFIG.COLOR_PRIMARY)
          .setDescription('Bu kurallara uymak **zorunludur**.')
          .addFields(
            { name: '1️⃣ Saygı', value: 'Küfür ve hakaret kesinlikle yasaktır.' },
            { name: '2️⃣ Hile Yasak', value: 'Her türlü hile/hack yasaktır. Kalıcı ban yenir.' },
            { name: '3️⃣ Reklam Yasak', value: 'Başka sunucu reklamı = anında kalıcı ban.' },
            { name: '4️⃣ Bug İstismarı', value: 'Bug kullanmak yasaktır, bulursan yetkililere bildir.' },
            { name: '5️⃣ Hesap Güvenliği', value: 'Hesabın güvenliğinden sen sorumlusun.' },
            { name: '6️⃣ Spam', value: 'Aynı mesajı tekrarlamak yasaktır.' },
            { name: '7️⃣ İtiraz', value: 'Haksız ceza için !ticket ile başvur.' },
          )
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !yardim ───────────────────────────────────────────────────────────
      case 'yardim': {
        const embed = new EmbedBuilder()
          .setTitle('❓ CombatMC Komutları')
          .setColor(CONFIG.COLOR_INFO)
          .addFields(
            { name: '🎮 Sunucu', value: '`!sunucu` `!boxpvp` `!boxmining` `!mod` `!ip` `!kurallar`' },
            { name: '🎫 Destek', value: '`!ticket` `!ticket-kur` (admin)' },
            { name: '🛡️ Moderasyon', value: '`!warn` `!uyarilar` `!uyarisil` `!mute` `!unmute` `!kick` `!ban` `!unban` `!temizle` `!yavaslat`' },
            { name: '🎉 Diğer', value: '`!anket` `!zar` `!kullanici` `!sunucuinfo` `!duyuru` `!ping`' },
          )
          .setFooter({ text: `Prefix: ${CONFIG.PREFIX}` })
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !ticket-kur ───────────────────────────────────────────────────────
      case 'ticket-kur': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return message.reply({ embeds: [makeEmbed('❌ Yetki Yok', 'Bu komutu sadece adminler kullanabilir!', CONFIG.COLOR_WARNING)] });
        }

        const targetChannel = message.mentions.channels.first() || message.channel;
        await sendTicketGUI(targetChannel, message.guild);
        await message.reply({ content: `✅ Ticket menüsü ${targetChannel} kanalına gönderildi!` });
        break;
      }

      // ── !ticket ───────────────────────────────────────────────────────────
      case 'ticket': {
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('ticket_kategori_select')
            .setPlaceholder('Talep kategorisi seç...')
            .addOptions([
              { label: '⚔️ Hile Şikayeti', value: 't_hile' },
              { label: '🚫 Ban İtirazı', value: 't_ban' },
              { label: '🔇 Mute İtirazı', value: 't_mute' },
              { label: '💰 Ödeme Sorunu', value: 't_odeme' },
              { label: '🐛 Bug Bildirimi', value: 't_bug' },
              { label: '📋 Yetkili Başvurusu', value: 't_basvuru' },
              { label: '❓ Diğer', value: 't_diger' },
            ])
        );
        const m = await message.reply({
          embeds: [makeEmbed('🎫 Destek Talebi', 'Kategori seç, ticket açılsın!', CONFIG.COLOR_INFO)],
          components: [row]
        });
        // 60 saniye sonra menüyü kaldır
        setTimeout(() => m.edit({ components: [] }).catch(() => {}), 60000);
        break;
      }

      // ── !warn ─────────────────────────────────────────────────────────────
      case 'warn': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          return message.reply('❌ Yetkin yok!');
        }
        const target = message.mentions.users.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        if (!target) return message.reply('❌ Kullanıcı etiketle! `!warn @kullanici sebep`');

        const count = addWarning(target.id, reason);
        await message.reply({
          embeds: [makeEmbed('⚠️ Uyarı Verildi', `**Kullanıcı:** ${target}\n**Sebep:** ${reason}\n**Uyarı:** ${count}/3\n**Yetkili:** ${message.author}`, CONFIG.COLOR_WARNING)]
        });
        try { await target.send({ embeds: [makeEmbed('⚠️ Uyarı Aldın!', `**${message.guild.name}** sunucusunda uyarı aldın!\n**Sebep:** ${reason}\n**Uyarı:** ${count}/3`, CONFIG.COLOR_WARNING)] }); } catch {}

        if (count >= 3) {
          const member = await message.guild.members.fetch(target.id).catch(() => null);
          if (member) await member.timeout(30 * 60 * 1000, '3 uyarı limitine ulaşıldı').catch(() => {});
          await message.channel.send({ embeds: [makeEmbed('🔇 Otomatik Mute', `${target} 3 uyarıya ulaştı, **30 dakika** susturuldu!`, CONFIG.COLOR_WARNING)] });
        }
        break;
      }

      // ── !uyarilar ─────────────────────────────────────────────────────────
      case 'uyarilar': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ `!uyarilar @kullanici`');
        const list = getWarnings(target.id);
        if (list.length === 0) return message.reply({ embeds: [makeEmbed('✅ Uyarı Yok', `${target} kullanıcısının uyarısı yok.`, CONFIG.COLOR_SUCCESS)] });
        const listText = list.map((w, idx) => `**${idx + 1}.** ${w.reason} — <t:${Math.floor(w.date.getTime() / 1000)}:R>`).join('\n');
        await message.reply({ embeds: [makeEmbed(`⚠️ ${target.username} Uyarıları (${list.length}/3)`, listText, CONFIG.COLOR_WARNING)] });
        break;
      }

      // ── !uyarisil ─────────────────────────────────────────────────────────
      case 'uyarisil': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ `!uyarisil @kullanici`');
        clearWarnings(target.id);
        await message.reply({ embeds: [makeEmbed('✅ Uyarılar Silindi', `${target} kullanıcısının uyarıları temizlendi.`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── !mute ─────────────────────────────────────────────────────────────
      case 'mute': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const target = message.mentions.members.first();
        const minutes = parseInt(args[1]) || 10;
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
        if (!target) return message.reply('❌ `!mute @kullanici dakika sebep`');
        await target.timeout(minutes * 60 * 1000, reason);
        await message.reply({ embeds: [makeEmbed('🔇 Susturuldu', `**Kullanıcı:** ${target}\n**Süre:** ${minutes} dakika\n**Sebep:** ${reason}`, CONFIG.COLOR_WARNING)] });
        try { await target.user.send({ embeds: [makeEmbed('🔇 Susturuldun!', `**${message.guild.name}** sunucusunda ${minutes} dakika susturuldun.\n**Sebep:** ${reason}`, CONFIG.COLOR_WARNING)] }); } catch {}
        break;
      }

      // ── !unmute ───────────────────────────────────────────────────────────
      case 'unmute': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ `!unmute @kullanici`');
        await target.timeout(null);
        await message.reply({ embeds: [makeEmbed('🔊 Susturma Kaldırıldı', `${target} artık konuşabilir.`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── !kick ─────────────────────────────────────────────────────────────
      case 'kick': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return message.reply('❌ Yetkin yok!');
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        if (!target) return message.reply('❌ `!kick @kullanici sebep`');
        await target.kick(reason);
        await message.reply({ embeds: [makeEmbed('👢 Atıldı', `**Kullanıcı:** ${target.user.tag}\n**Sebep:** ${reason}`, CONFIG.COLOR_WARNING)] });
        break;
      }

      // ── !ban ──────────────────────────────────────────────────────────────
      case 'ban': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkin yok!');
        const target = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        if (!target) return message.reply('❌ `!ban @kullanici sebep`');
        try { await target.user.send({ embeds: [makeEmbed('🔨 Yasaklandın!', `**${message.guild.name}** sunucusundan yasaklandın.\n**Sebep:** ${reason}`, CONFIG.COLOR_PRIMARY)] }); } catch {}
        await target.ban({ deleteMessageSeconds: 86400, reason });
        await message.reply({ embeds: [makeEmbed('🔨 Yasaklandı', `**Kullanıcı:** ${target.user.tag}\n**Sebep:** ${reason}`, CONFIG.COLOR_PRIMARY)] });
        break;
      }

      // ── !unban ────────────────────────────────────────────────────────────
      case 'unban': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return message.reply('❌ Yetkin yok!');
        const id = args[0];
        if (!id) return message.reply('❌ `!unban <kullanici_id>`');
        await message.guild.members.unban(id).catch(() => {});
        await message.reply({ embeds: [makeEmbed('✅ Yasak Kaldırıldı', `ID: \`${id}\` yasağı kaldırıldı.`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── !temizle ──────────────────────────────────────────────────────────
      case 'temizle': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const amount = Math.min(parseInt(args[0]) || 10, 100);
        await message.delete().catch(() => {});
        const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
        const m = await message.channel.send(`✅ **${deleted?.size || 0}** mesaj silindi.`);
        setTimeout(() => m.delete().catch(() => {}), 3000);
        break;
      }

      // ── !yavaslat ─────────────────────────────────────────────────────────
      case 'yavaslat': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply('❌ Yetkin yok!');
        const saniye = parseInt(args[0]) || 0;
        await message.channel.setRateLimitPerUser(saniye);
        if (saniye === 0) {
          await message.reply({ embeds: [makeEmbed('✅ Yavaş Mod Kapatıldı', 'Yavaş mod kapatıldı.', CONFIG.COLOR_SUCCESS)] });
        } else {
          await message.reply({ embeds: [makeEmbed('🐌 Yavaş Mod', `Yavaş mod **${saniye} saniye** olarak ayarlandı.`, CONFIG.COLOR_WARNING)] });
        }
        break;
      }

      // ── !kullanici ────────────────────────────────────────────────────────
      case 'kullanici': {
        const target = message.mentions.members.first() || message.member;
        const user = target.user;
        const roles = target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(', ') || 'Yok';
        const embed = new EmbedBuilder()
          .setTitle(`👤 ${user.username}`)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .setColor(target.displayHexColor || CONFIG.COLOR_INFO)
          .addFields(
            { name: '🏷️ Tag', value: user.tag, inline: true },
            { name: '🆔 ID', value: user.id, inline: true },
            { name: '📅 Hesap', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '📥 Katılma', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: '⚠️ Uyarılar', value: `${getWarnings(user.id).length}/3`, inline: true },
            { name: '🎭 Roller', value: roles.length > 1024 ? roles.substring(0, 1020) + '...' : roles },
          )
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !sunucuinfo ───────────────────────────────────────────────────────
      case 'sunucuinfo': {
        const g = message.guild;
        const embed = new EmbedBuilder()
          .setTitle(`🏰 ${g.name}`)
          .setThumbnail(g.iconURL())
          .setColor(CONFIG.COLOR_INFO)
          .addFields(
            { name: '👑 Kurucu', value: `<@${g.ownerId}>`, inline: true },
            { name: '👥 Üyeler', value: `${g.memberCount}`, inline: true },
            { name: '📅 Oluşturulma', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '💬 Kanallar', value: `${g.channels.cache.size}`, inline: true },
            { name: '🎭 Roller', value: `${g.roles.cache.size}`, inline: true },
            { name: '😀 Emojiler', value: `${g.emojis.cache.size}`, inline: true },
          )
          .setTimestamp();
        await message.reply({ embeds: [embed] });
        break;
      }

      // ── !anket ────────────────────────────────────────────────────────────
      case 'anket': {
        const parts = message.content.slice(CONFIG.PREFIX.length + 'anket'.length).trim().split('|').map(s => s.trim());
        if (parts.length < 3) return message.reply('❌ `!anket Soru | Seçenek 1 | Seçenek 2 | ...`');
        const soru = parts[0];
        const opts = parts.slice(1, 5);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        const optText = opts.map((o, idx) => `${emojis[idx]} ${o}`).join('\n');
        const msg = await message.channel.send({ embeds: [makeEmbed(`📊 ${soru}`, optText + '\n\n*Aşağıdaki emojilerle oy kullanın!*', CONFIG.COLOR_INFO)] });
        for (let idx = 0; idx < opts.length; idx++) await msg.react(emojis[idx]);
        await message.delete().catch(() => {});
        break;
      }

      // ── !duyuru ───────────────────────────────────────────────────────────
      case 'duyuru': {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const msg = args.join(' ');
        if (!msg) return message.reply('❌ `!duyuru <mesaj>`');
        await message.channel.send({ content: '@everyone', embeds: [makeEmbed('📢 DUYURU', msg, CONFIG.COLOR_PRIMARY)] });
        await message.delete().catch(() => {});
        break;
      }

      // ── !zar ──────────────────────────────────────────────────────────────
      case 'zar': {
        const sides = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await message.reply({ embeds: [makeEmbed('🎲 Zar!', `${message.author} **${sides} yüzlü** zar attı → **${result}**`, CONFIG.COLOR_SUCCESS)] });
        break;
      }

      // ── !ping ─────────────────────────────────────────────────────────────
      case 'ping': {
        const start = Date.now();
        const m = await message.reply('Ölçülüyor...');
        await m.edit({
          content: '',
          embeds: [makeEmbed('🏓 Pong!', `**Bot:** ${Date.now() - start}ms\n**API:** ${Math.round(client.ws.ping)}ms`, CONFIG.COLOR_SUCCESS)]
        });
        break;
      }
    }
  } catch (err) {
    console.error(`[HATA] !${command}:`, err);
    message.reply({ embeds: [makeEmbed('❌ Hata', 'Bir hata oluştu, tekrar dene!', CONFIG.COLOR_WARNING)] }).catch(() => {});
  }
});

// ─── INTERACTION HANDLER ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) await handleButton(interaction);
  else if (interaction.isStringSelectMenu()) await handleSelect(interaction);
});

// ─── BUTTON HANDLER ───────────────────────────────────────────────────────────
async function handleButton(i) {
  // Ticket açma butonları
  if (Object.keys(TICKET_LABELS).includes(i.customId)) {
    if (i.customId === 't_basvuru') {
      return showBasvuruModal(i);
    }
    return createTicket(i, i.customId);
  }

  switch (i.customId) {
    case 'ticket_kapat': {
      const validPrefixes = ['ticket-', 'sikayet-', 'basvuru-'];
      if (!validPrefixes.some(p => i.channel.name.startsWith(p))) {
        return i.reply({ content: '❌ Bu kanal bir ticket değil!', ephemeral: true });
      }
      await i.reply({ embeds: [makeEmbed('🔒 Kapatılıyor', '5 saniye içinde kanal silinecek...', CONFIG.COLOR_WARNING)] });
      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
      break;
    }
    case 'info_boxpvp': {
      const m = CONFIG.MODES.boxpvp;
      await i.reply({ embeds: [new EmbedBuilder().setTitle(m.name).setDescription(m.desc).setColor(m.color).addFields({ name: '🌐 IP', value: `\`${m.ip}\``, inline: true }, { name: '🎮 Sürüm', value: `\`${m.version}\``, inline: true }, { name: '✨ Özellikler', value: m.features.join('\n') })], ephemeral: true });
      break;
    }
    case 'info_boxmining': {
      const m = CONFIG.MODES.boxmining;
      await i.reply({ embeds: [new EmbedBuilder().setTitle(m.name).setDescription(m.desc).setColor(m.color).addFields({ name: '🌐 IP', value: `\`${m.ip}\``, inline: true }, { name: '🎮 Sürüm', value: `\`${m.version}\``, inline: true }, { name: '✨ Özellikler', value: m.features.join('\n') })], ephemeral: true });
      break;
    }
    case 'info_mod': {
      const m = CONFIG.MODES.mod;
      await i.reply({ embeds: [new EmbedBuilder().setTitle(m.name).setDescription(m.desc).setColor(m.color).addFields({ name: '🌐 IP', value: `\`${m.ip}\``, inline: true }, { name: '🎮 Sürüm', value: `\`${m.version}\``, inline: true }, { name: '📦 Modpack', value: m.modpack }, { name: '✨ Özellikler', value: m.features.join('\n') })], ephemeral: true });
      break;
    }
  }
}

// ─── SELECT HANDLER ───────────────────────────────────────────────────────────
async function handleSelect(i) {
  if (i.customId === 'ticket_kategori_select') {
    const value = i.values[0];
    if (value === 't_basvuru') return showBasvuruModal(i);
    return createTicket(i, value);
  }
}

// ─── BAŞVURU MODAL ────────────────────────────────────────────────────────────
async function showBasvuruModal(i) {
  const modal = new ModalBuilder()
    .setCustomId('basvuru_modal')
    .setTitle('⚔️ CombatMC Yetkili Başvurusu');

  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('Minecraft Kullanıcı Adın').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yas').setLabel('Yaşın').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tecrube').setLabel('Moderasyon Tecrüben').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Daha önce hangi sunucularda yetkili oldun?')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('neden').setLabel('Neden Yetkili Olmak İstiyorsun?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gunluk').setLabel('Günlük Kaç Saat Aktif Olabilirsin?').setStyle(TextInputStyle.Short).setRequired(true)),
  );

  await i.showModal(modal);

  const submitted = await i.awaitModalSubmit({ time: 5 * 60 * 1000, filter: m => m.user.id === i.user.id }).catch(() => null);
  if (!submitted) return;

  const ign     = submitted.fields.getTextInputValue('ign');
  const yas     = submitted.fields.getTextInputValue('yas');
  const tecrube = submitted.fields.getTextInputValue('tecrube');
  const neden   = submitted.fields.getTextInputValue('neden');
  const gunluk  = submitted.fields.getTextInputValue('gunluk');

  const guild = submitted.guild;
  const channelName = `basvuru-${submitted.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const channel = await guild.channels.create({
    name: channelName,
    type: 0,
    parent: CONFIG.TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: submitted.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
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
      .setThumbnail(submitted.user.displayAvatarURL())
      .addFields(
        { name: '👤 Discord', value: submitted.user.toString(), inline: true },
        { name: '⛏️ IGN', value: ign, inline: true },
        { name: '🎂 Yaş', value: yas, inline: true },
        { name: '⏰ Günlük Aktiflik', value: `${gunluk} saat`, inline: true },
        { name: '📚 Tecrübe', value: tecrube },
        { name: '💬 Neden Yetkili?', value: neden },
      )
      .setTimestamp()
    ],
    components: [closeRow]
  });

  await submitted.reply({ content: `✅ Başvurun alındı! ${channel} kanalından takip edebilirsin.`, ephemeral: true });
}

// ─── MEMBER JOIN ──────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
  if (!welcomeChannelId) return;
  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('⚔️ CombatMC\'ye Hoş Geldin!')
    .setDescription(`${member} sunucumuza katıldı!\n\n**⚔️ BoxPvP:** \`${CONFIG.MODES.boxpvp.ip}\`\n**⛏️ BoxMining:** \`${CONFIG.MODES.boxmining.ip}\`\n**🗡️ Mod:** \`${CONFIG.MODES.mod.ip}\`\n\n**📜 Kurallar:** \`!kurallar\`\n**🎫 Destek:** \`!ticket\``)
    .setColor(CONFIG.COLOR_SUCCESS)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `${member.guild.name} • Üye #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
client.on('error', err => console.error('Discord Client Error:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('❌ DISCORD_TOKEN tanımlı değil! Railway Variables kısmına ekle.');
client.login(token);
