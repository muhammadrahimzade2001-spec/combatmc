const {
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, Collection,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
});

// ════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════
const CFG = {
  PREFIX: '!',
  SERVER_NAME: 'CombatMC',
  SERVER_IP: 'mc.combatmc.net',
  COLORS: {
    red:     0xFF4444,
    green:   0x00FF88,
    yellow:  0xFFAA00,
    blue:    0x4488FF,
    gold:    0xFFD700,
  },
  TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
  MOD_ROLE_ID:        process.env.MOD_ROLE_ID        || null,
  ADMIN_ROLE_ID:      process.env.ADMIN_ROLE_ID      || null,
  LOG_CHANNEL_ID:     process.env.LOG_CHANNEL_ID     || null,
  WELCOME_CHANNEL_ID: process.env.WELCOME_CHANNEL_ID || null,
};

// ════════════════════════════════════════════════
//  YARDIMCI FONKSİYONLAR
// ════════════════════════════════════════════════
const embed = (title, desc, color = CFG.COLORS.blue) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: CFG.SERVER_NAME });

const isMod   = m => m.permissions.has(PermissionsBitField.Flags.ModerateMembers);
const isAdmin = m => m.permissions.has(PermissionsBitField.Flags.Administrator);

// ════════════════════════════════════════════════
//  UYARI SİSTEMİ (in-memory)
// ════════════════════════════════════════════════
const warns = new Map(); // userId → [{ reason, date }]

const warn = {
  add(id, reason) {
    if (!warns.has(id)) warns.set(id, []);
    warns.get(id).push({ reason, date: new Date() });
    return warns.get(id).length;
  },
  get(id)   { return warns.get(id) || []; },
  clear(id) { warns.delete(id); },
};

// ════════════════════════════════════════════════
//  COOLDOWN
// ════════════════════════════════════════════════
const cooldowns = new Collection();

function cooldown(userId, cmd, secs) {
  const key = `${userId}:${cmd}`;
  const now = Date.now();
  const hit = cooldowns.get(key);
  if (hit) {
    const left = hit + secs * 1000 - now;
    if (left > 0) return Math.ceil(left / 1000);
  }
  cooldowns.set(key, now);
  return 0;
}

// ════════════════════════════════════════════════
//  KÜFÜR FİLTRESİ
// ════════════════════════════════════════════════
const BAD_WORDS = [
  'orospu','oç','göt','sik','amk','amına','yarrak','piç','ibne','kaltak','fahişe',
  'fuck','shit','bitch','dick','pussy','nigga','nigger','bastard','motherfucker','asshole','cunt',
];

function hasBadWord(text) {
  const clean = text.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/gi, '');
  return BAD_WORDS.some(w => clean.includes(w));
}

// ════════════════════════════════════════════════
//  TİCKET SİSTEMİ
// ════════════════════════════════════════════════
const TICKET_TYPES = {
  t_hile:    { label: '⚔️ Hile Şikayeti',      style: ButtonStyle.Danger },
  t_ban:     { label: '🚫 Ban İtirazı',          style: ButtonStyle.Primary },
  t_mute:    { label: '🔇 Mute İtirazı',         style: ButtonStyle.Primary },
  t_odeme:   { label: '💰 Ödeme Sorunu',          style: ButtonStyle.Success },
  t_bug:     { label: '🐛 Bug Bildirimi',         style: ButtonStyle.Secondary },
  t_basvuru: { label: '📋 Yetkili Başvurusu',    style: ButtonStyle.Success },
  t_diger:   { label: '❓ Diğer',                style: ButtonStyle.Secondary },
};

// Destek kanalına ticket menüsü gönder
async function sendTicketPanel(channel) {
  const e = new EmbedBuilder()
    .setTitle('🎫 CombatMC — Destek Merkezi')
    .setColor(CFG.COLORS.blue)
    .setDescription(
      '**Bir kategori seçerek destek talebi oluştur:**\n\n' +
      '⚔️ **Hile Şikayeti** — Hileci oyuncu bildir\n' +
      '🚫 **Ban İtirazı** — Haksız ban için başvur\n' +
      '🔇 **Mute İtirazı** — Haksız mute için başvur\n' +
      '💰 **Ödeme Sorunu** — VIP / mağaza sorunları\n' +
      '🐛 **Bug Bildirimi** — Oyun içi hata bildir\n' +
      '📋 **Yetkili Başvurusu** — Ekibe katılmak için başvur\n' +
      '❓ **Diğer** — Diğer konular\n\n' +
      '> ⚠️ Gereksiz ticket açmak **ceza sebebidir!**'
    )
    .setFooter({ text: 'CombatMC • Ekibimiz en kısa sürede yardımcı olacak!' })
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

  await channel.send({ embeds: [e], components: [row1, row2] });
}

// Normal ticket oluştur
async function createTicket(interaction, typeId) {
  const { guild, user } = interaction;
  const type = TICKET_TYPES[typeId];
  const chName = `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const existing = guild.channels.cache.find(c => c.name === chName);
  if (existing) {
    return interaction.reply({ content: `❌ Zaten açık bir ticketin var: ${existing}`, ephemeral: true });
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
  ];
  if (CFG.MOD_ROLE_ID) overwrites.push({ id: CFG.MOD_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });

  const ch = await guild.channels.create({
    name: chName,
    type: 0,
    parent: CFG.TICKET_CATEGORY_ID,
    permissionOverwrites: overwrites,
  });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Ticketi Kapat').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_al').setLabel('📌 Ticketi Al').setStyle(ButtonStyle.Secondary),
  );

  const ping = [user.toString(), CFG.MOD_ROLE_ID ? `<@&${CFG.MOD_ROLE_ID}>` : ''].filter(Boolean).join(' ');

  await ch.send({
    content: ping,
    embeds: [
      embed(
        `🎫 ${type.label}`,
        `**Kullanıcı:** ${user}\n**Kategori:** ${type.label}\n**Tarih:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n📝 Sorununuzu **detaylı** açıklayın. Ekibimiz en kısa sürede yardımcı olacak!`,
        CFG.COLORS.blue
      ),
    ],
    components: [closeBtn],
  });

  await interaction.reply({ content: `✅ Ticketin oluşturuldu: ${ch}`, ephemeral: true });

  // Log
  if (CFG.LOG_CHANNEL_ID) {
    const logCh = guild.channels.cache.get(CFG.LOG_CHANNEL_ID);
    if (logCh) logCh.send({ embeds: [embed('📋 Ticket Açıldı', `**Kullanıcı:** ${user.tag}\n**Tür:** ${type.label}\n**Kanal:** ${ch}`, CFG.COLORS.gold)] });
  }
}

// Yetkili başvurusu modal
async function showBasvuruModal(interaction) {
  const modal = new ModalBuilder().setCustomId('basvuru_modal').setTitle('📋 Yetkili Başvurusu');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel('Minecraft Kullanıcı Adın').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('yas').setLabel('Yaşın').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tecrube').setLabel('Moderasyon Tecrüben').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Daha önce hangi sunucularda yetkili oldun?')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('neden').setLabel('Neden Yetkili Olmak İstiyorsun?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gunluk').setLabel('Günlük Kaç Saat Aktif Olabilirsin?').setStyle(TextInputStyle.Short).setRequired(true)),
  );

  await interaction.showModal(modal);

  const submitted = await interaction.awaitModalSubmit({ time: 5 * 60 * 1000, filter: m => m.user.id === interaction.user.id }).catch(() => null);
  if (!submitted) return;

  const { guild, user } = submitted;
  const chName = `basvuru-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const existing = guild.channels.cache.find(c => c.name === chName);
  if (existing) return submitted.reply({ content: `❌ Zaten açık bir başvurun var: ${existing}`, ephemeral: true });

  const overwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
  ];
  if (CFG.ADMIN_ROLE_ID) overwrites.push({ id: CFG.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });

  const ch = await guild.channels.create({
    name: chName,
    type: 0,
    parent: CFG.TICKET_CATEGORY_ID,
    permissionOverwrites: overwrites,
  });

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Kapat / Reddet').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('basvuru_kabul').setLabel('✅ Kabul Et').setStyle(ButtonStyle.Success),
  );

  await ch.send({
    content: CFG.ADMIN_ROLE_ID ? `<@&${CFG.ADMIN_ROLE_ID}>` : '',
    embeds: [
      new EmbedBuilder()
        .setTitle('📋 Yeni Yetkili Başvurusu')
        .setColor(CFG.COLORS.gold)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: '👤 Discord', value: user.toString(), inline: true },
          { name: '⛏️ IGN', value: submitted.fields.getTextInputValue('ign'), inline: true },
          { name: '🎂 Yaş', value: submitted.fields.getTextInputValue('yas'), inline: true },
          { name: '⏰ Günlük Aktiflik', value: `${submitted.fields.getTextInputValue('gunluk')} saat`, inline: true },
          { name: '📚 Tecrübe', value: submitted.fields.getTextInputValue('tecrube') },
          { name: '💬 Neden Yetkili?', value: submitted.fields.getTextInputValue('neden') },
        )
        .setTimestamp()
        .setFooter({ text: CFG.SERVER_NAME }),
    ],
    components: [closeBtn],
  });

  await submitted.reply({ content: `✅ Başvurun alındı! ${ch} kanalından takip edebilirsin.`, ephemeral: true });
}

// ════════════════════════════════════════════════
//  READY
// ════════════════════════════════════════════════
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} aktif!`);
  client.user.setActivity(`${CFG.SERVER_IP} | !yardim`, { type: 0 });
});

// ════════════════════════════════════════════════
//  MESAJ HANDLER
// ════════════════════════════════════════════════
client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  // ── Küfür filtresi ─────────────────────────────
  if (hasBadWord(msg.content)) {
    try { await msg.delete(); } catch {}
    const count = warn.add(msg.author.id, 'Otomatik: küfür/hakaret');
    const r = await msg.channel.send({
      embeds: [embed(
        '🚫 Yasak Kelime',
        `${msg.author} küfür ve hakaret yasaktır!\n> ⚠️ Uyarı: **${count}/3**${count >= 3 ? '\n🔇 **3 uyarı: 10 dakika susturuldun!**' : ''}`,
        CFG.COLORS.yellow
      )],
    });
    if (count >= 3) {
      try { await msg.member.timeout(10 * 60 * 1000, 'Otomatik: 3 uyarı'); } catch {}
    }
    setTimeout(() => r.delete().catch(() => {}), 7000);

    if (CFG.LOG_CHANNEL_ID) {
      const lc = msg.guild.channels.cache.get(CFG.LOG_CHANNEL_ID);
      if (lc) lc.send({ embeds: [embed('📋 Küfür Logu', `**Kullanıcı:** ${msg.author.tag}\n**Kanal:** ${msg.channel}\n**İçerik:** ||${msg.content.slice(0, 200)}||\n**Uyarı:** ${count}/3`, CFG.COLORS.yellow)] });
    }
    return;
  }

  if (!msg.content.startsWith(CFG.PREFIX)) return;

  const args = msg.content.slice(CFG.PREFIX.length).trim().split(/ +/);
  const cmd  = args.shift().toLowerCase();

  // Cooldown (3sn)
  const wait = cooldown(msg.author.id, cmd, 3);
  if (wait > 0) {
    const m = await msg.reply(`⏳ **${wait} saniye** bekle!`);
    setTimeout(() => m.delete().catch(() => {}), 3000);
    return;
  }

  try {
    switch (cmd) {

      // ── !sunucu ─────────────────────────────────
      case 'sunucu': {
        await msg.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('⚔️ CombatMC')
              .setColor(CFG.COLORS.red)
              .setDescription('🔥 **Türkiye\'nin en iyi BoxPvP sunucusu!**\nRakiplerini ez, tabloya çık, efsane ol.')
              .addFields(
                { name: '🌐 Sunucu IP', value: `\`${CFG.SERVER_IP}\``, inline: true },
                { name: '🎮 Sürümler', value: '`1.8 — 1.21`', inline: true },
                { name: '✨ Özellikler', value: '🎯 Kit sistemi\n🏆 Sıralama tablosu\n💎 VIP kitler\n⚡ Hızlı respawn' },
              )
              .setFooter({ text: 'CombatMC • Savaş başlıyor!' })
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── !kurallar ───────────────────────────────
      case 'kurallar': {
        await msg.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📜 Sunucu Kuralları')
              .setColor(CFG.COLORS.red)
              .addFields(
                { name: '1️⃣ Saygı',          value: 'Küfür ve hakaret yasaktır.' },
                { name: '2️⃣ Hile Yasak',     value: 'Her türlü hile/hack = kalıcı ban.' },
                { name: '3️⃣ Reklam Yasak',   value: 'Başka sunucu reklamı = kalıcı ban.' },
                { name: '4️⃣ Bug İstismarı',  value: 'Bug kullanmak yasaktır, bulursan bildir.' },
                { name: '5️⃣ Spam',           value: 'Aynı mesajı tekrar tekrar atmak yasaktır.' },
                { name: '6️⃣ İtiraz',         value: 'Haksız ceza için ticket aç.' },
              )
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── !yardim ─────────────────────────────────
      case 'yardim': {
        await msg.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❓ Komut Listesi')
              .setColor(CFG.COLORS.blue)
              .addFields(
                { name: '🎮 Genel',      value: '`!sunucu` `!kurallar` `!ping` `!zar` `!kullanici`' },
                { name: '📊 Eğlence',   value: '`!anket Soru | A | B | C`' },
                { name: '🎫 Destek',    value: '`!ticket-kur` *(admin — destek kanalına panel kurar)*' },
                { name: '🛡️ Mod',      value: '`!warn` `!uyarilar` `!uyarisil`\n`!mute` `!unmute` `!kick` `!ban` `!unban`\n`!temizle` `!yavaslat` `!duyuru`' },
              )
              .setFooter({ text: `Prefix: ${CFG.PREFIX}` })
              .setTimestamp(),
          ],
        });
        break;
      }

      // ── !ticket-kur ─────────────────────────────
      case 'ticket-kur': {
        if (!isAdmin(msg.member)) return msg.reply('❌ Sadece adminler kullanabilir!');
        const target = msg.mentions.channels.first() || msg.channel;
        await sendTicketPanel(target);
        await msg.reply(`✅ Ticket paneli ${target} kanalına kuruldu!`);
        break;
      }

      // ── MOD KOMUTLARI ───────────────────────────

      case 'warn': {
        if (!isMod(msg.member)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.users.first();
        if (!t) return msg.reply('❌ Kullanım: `!warn @kullanici sebep`');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        const count  = warn.add(t.id, reason);
        await msg.reply({ embeds: [embed('⚠️ Uyarı Verildi', `**Kullanıcı:** ${t}\n**Sebep:** ${reason}\n**Uyarı:** ${count}/3\n**Yetkili:** ${msg.author}`, CFG.COLORS.yellow)] });
        try { await t.send({ embeds: [embed('⚠️ Uyarı Aldın!', `**${msg.guild.name}** sunucusunda uyarı aldın.\n**Sebep:** ${reason}\n**Uyarı:** ${count}/3`, CFG.COLORS.yellow)] }); } catch {}
        if (count >= 3) {
          const mem = await msg.guild.members.fetch(t.id).catch(() => null);
          if (mem) await mem.timeout(30 * 60 * 1000, '3 uyarı limitine ulaşıldı').catch(() => {});
          await msg.channel.send({ embeds: [embed('🔇 Otomatik Mute', `${t} 3 uyarıya ulaştı → **30 dakika** susturuldu!`, CFG.COLORS.yellow)] });
        }
        break;
      }

      case 'uyarilar': {
        if (!isMod(msg.member)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.users.first();
        if (!t) return msg.reply('❌ `!uyarilar @kullanici`');
        const list = warn.get(t.id);
        if (!list.length) return msg.reply({ embeds: [embed('✅ Temiz', `${t} kullanıcısının uyarısı yok.`, CFG.COLORS.green)] });
        const text = list.map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.date / 1000)}:R>`).join('\n');
        await msg.reply({ embeds: [embed(`⚠️ ${t.username} — Uyarılar (${list.length}/3)`, text, CFG.COLORS.yellow)] });
        break;
      }

      case 'uyarisil': {
        if (!isMod(msg.member)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.users.first();
        if (!t) return msg.reply('❌ `!uyarisil @kullanici`');
        warn.clear(t.id);
        await msg.reply({ embeds: [embed('✅ Uyarılar Silindi', `${t} kullanıcısının tüm uyarıları temizlendi.`, CFG.COLORS.green)] });
        break;
      }

      case 'mute': {
        if (!isMod(msg.member)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.members.first();
        if (!t) return msg.reply('❌ `!mute @kullanici dakika sebep`');
        const mins   = parseInt(args[1]) || 10;
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
        await t.timeout(mins * 60 * 1000, reason);
        await msg.reply({ embeds: [embed('🔇 Susturuldu', `**Kullanıcı:** ${t}\n**Süre:** ${mins} dakika\n**Sebep:** ${reason}`, CFG.COLORS.yellow)] });
        try { await t.user.send({ embeds: [embed('🔇 Susturuldun!', `**${msg.guild.name}** — ${mins} dk susturuldun.\n**Sebep:** ${reason}`, CFG.COLORS.yellow)] }); } catch {}
        break;
      }

      case 'unmute': {
        if (!isMod(msg.member)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.members.first();
        if (!t) return msg.reply('❌ `!unmute @kullanici`');
        await t.timeout(null);
        await msg.reply({ embeds: [embed('🔊 Susturma Kaldırıldı', `${t} artık konuşabilir.`, CFG.COLORS.green)] });
        break;
      }

      case 'kick': {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.members.first();
        if (!t) return msg.reply('❌ `!kick @kullanici sebep`');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        await t.kick(reason);
        await msg.reply({ embeds: [embed('👢 Atıldı', `**Kullanıcı:** ${t.user.tag}\n**Sebep:** ${reason}`, CFG.COLORS.yellow)] });
        break;
      }

      case 'ban': {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return msg.reply('❌ Yetkin yok!');
        const t = msg.mentions.members.first();
        if (!t) return msg.reply('❌ `!ban @kullanici sebep`');
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
        try { await t.user.send({ embeds: [embed('🔨 Yasaklandın!', `**${msg.guild.name}** — Yasaklandın.\n**Sebep:** ${reason}`, CFG.COLORS.red)] }); } catch {}
        await t.ban({ deleteMessageSeconds: 86400, reason });
        await msg.reply({ embeds: [embed('🔨 Yasaklandı', `**Kullanıcı:** ${t.user.tag}\n**Sebep:** ${reason}`, CFG.COLORS.red)] });
        break;
      }

      case 'unban': {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return msg.reply('❌ Yetkin yok!');
        const id = args[0];
        if (!id) return msg.reply('❌ `!unban <id>`');
        await msg.guild.members.unban(id).catch(() => {});
        await msg.reply({ embeds: [embed('✅ Yasak Kaldırıldı', `ID \`${id}\` yasağı kaldırıldı.`, CFG.COLORS.green)] });
        break;
      }

      case 'temizle': {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return msg.reply('❌ Yetkin yok!');
        const amount = Math.min(parseInt(args[0]) || 10, 100);
        await msg.delete().catch(() => {});
        const del = await msg.channel.bulkDelete(amount, true).catch(() => null);
        const m = await msg.channel.send(`✅ **${del?.size || 0}** mesaj silindi.`);
        setTimeout(() => m.delete().catch(() => {}), 3000);
        break;
      }

      case 'yavaslat': {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return msg.reply('❌ Yetkin yok!');
        const sn = parseInt(args[0]) || 0;
        await msg.channel.setRateLimitPerUser(sn);
        await msg.reply({ embeds: [embed(sn === 0 ? '✅ Yavaş Mod Kapatıldı' : '🐌 Yavaş Mod', sn === 0 ? 'Yavaş mod kapatıldı.' : `Yavaş mod **${sn} saniye** olarak ayarlandı.`, sn === 0 ? CFG.COLORS.green : CFG.COLORS.yellow)] });
        break;
      }

      case 'duyuru': {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return msg.reply('❌ Yetkin yok!');
        const text = args.join(' ');
        if (!text) return msg.reply('❌ `!duyuru <mesaj>`');
        await msg.channel.send({ content: '@everyone', embeds: [embed('📢 DUYURU', text, CFG.COLORS.red)] });
        await msg.delete().catch(() => {});
        break;
      }

      // ── EĞLENCELİK ──────────────────────────────

      case 'kullanici': {
        const t     = msg.mentions.members.first() || msg.member;
        const roles = t.roles.cache.filter(r => r.id !== msg.guild.id).map(r => r.toString()).join(', ') || 'Yok';
        await msg.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`👤 ${t.user.username}`)
              .setThumbnail(t.user.displayAvatarURL({ size: 256 }))
              .setColor(t.displayHexColor || CFG.COLORS.blue)
              .addFields(
                { name: '🆔 ID',         value: t.user.id,                                         inline: true },
                { name: '📅 Hesap',      value: `<t:${Math.floor(t.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📥 Katılma',    value: `<t:${Math.floor(t.joinedTimestamp / 1000)}:R>`,      inline: true },
                { name: '⚠️ Uyarılar',  value: `${warn.get(t.user.id).length}/3`,                    inline: true },
                { name: '🎭 Roller',     value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles },
              )
              .setTimestamp(),
          ],
        });
        break;
      }

      case 'anket': {
        const parts = msg.content.slice(CFG.PREFIX.length + 'anket'.length).trim().split('|').map(s => s.trim());
        if (parts.length < 3) return msg.reply('❌ `!anket Soru | Seçenek A | Seçenek B`');
        const soru = parts[0];
        const opts  = parts.slice(1, 5);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        const m = await msg.channel.send({
          embeds: [embed(`📊 ${soru}`, opts.map((o, i) => `${emojis[i]} ${o}`).join('\n') + '\n\n*Oy vermek için emojiye tıkla!*', CFG.COLORS.blue)],
        });
        for (let i = 0; i < opts.length; i++) await m.react(emojis[i]);
        await msg.delete().catch(() => {});
        break;
      }

      case 'zar': {
        const sides  = parseInt(args[0]) || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        await msg.reply({ embeds: [embed('🎲 Zar!', `${msg.author} **${sides} yüzlü** zar attı → **${result}**`, CFG.COLORS.green)] });
        break;
      }

      case 'ping': {
        const start = Date.now();
        const m = await msg.reply('⏱️ Ölçülüyor...');
        await m.edit({ content: '', embeds: [embed('🏓 Pong!', `**Bot:** ${Date.now() - start}ms\n**API:** ${Math.round(client.ws.ping)}ms`, CFG.COLORS.green)] });
        break;
      }
    }
  } catch (err) {
    console.error(`[HATA] !${cmd}:`, err);
    msg.reply({ embeds: [embed('❌ Hata', 'Bir şeyler ters gitti, tekrar dene!', CFG.COLORS.yellow)] }).catch(() => {});
  }
});

// ════════════════════════════════════════════════
//  INTERACTION HANDLER
// ════════════════════════════════════════════════
client.on('interactionCreate', async (i) => {
  if (!i.isButton()) return;

  // Ticket aç butonları
  if (Object.keys(TICKET_TYPES).includes(i.customId)) {
    if (i.customId === 't_basvuru') return showBasvuruModal(i);
    return createTicket(i, i.customId);
  }

  switch (i.customId) {

    case 'ticket_kapat': {
      const valid = ['ticket-', 'basvuru-', 'sikayet-'];
      if (!valid.some(p => i.channel.name.startsWith(p))) {
        return i.reply({ content: '❌ Bu kanal bir ticket değil!', ephemeral: true });
      }
      if (!isMod(i.member) && !i.channel.permissionsFor(i.user).has(PermissionsBitField.Flags.SendMessages)) {
        return i.reply({ content: '❌ Bu işlem için yetkin yok!', ephemeral: true });
      }
      await i.reply({ embeds: [embed('🔒 Kapatılıyor', '5 saniye içinde kanal silinecek...', CFG.COLORS.yellow)] });

      // Log: ticket kapanıyor
      if (CFG.LOG_CHANNEL_ID) {
        const lc = i.guild.channels.cache.get(CFG.LOG_CHANNEL_ID);
        if (lc) lc.send({ embeds: [embed('📋 Ticket Kapatıldı', `**Kanal:** ${i.channel.name}\n**Kapatan:** ${i.user.tag}`, CFG.COLORS.red)] });
      }

      setTimeout(() => i.channel.delete().catch(() => {}), 5000);
      break;
    }

    case 'ticket_al': {
      // Yetkili ticketi üstleniyor
      if (!isMod(i.member)) return i.reply({ content: '❌ Yetkin yok!', ephemeral: true });
      await i.reply({ embeds: [embed('📌 Ticket Alındı', `Bu ticket **${i.user}** tarafından üstlenildi!`, CFG.COLORS.green)] });
      break;
    }

    case 'basvuru_kabul': {
      if (!isAdmin(i.member)) return i.reply({ content: '❌ Sadece adminler kullanabilir!', ephemeral: true });
      // Başvuruyu kabul et: başvuru sahibine DM gönder
      const ownerName = i.channel.name.replace('basvuru-', '');
      const owner = i.guild.members.cache.find(m => m.user.username.toLowerCase() === ownerName);
      if (owner) {
        try {
          await owner.user.send({ embeds: [embed('🎉 Başvurun Kabul Edildi!', `**${i.guild.name}** sunucusundaki yetkili başvurun kabul edildi! Tebrikler!`, CFG.COLORS.green)] });
        } catch {}
      }
      await i.reply({ embeds: [embed('✅ Başvuru Kabul Edildi', 'Kullanıcıya bildirim gönderildi. Kanal 10 saniye içinde kapanacak.', CFG.COLORS.green)] });
      setTimeout(() => i.channel.delete().catch(() => {}), 10000);
      break;
    }
  }
});

// ════════════════════════════════════════════════
//  ÜYE GİRİŞ / ÇIKIŞ
// ════════════════════════════════════════════════
client.on('guildMemberAdd', async (member) => {
  if (!CFG.WELCOME_CHANNEL_ID) return;
  const ch = member.guild.channels.cache.get(CFG.WELCOME_CHANNEL_ID);
  if (!ch) return;
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setAuthor({ name: '🎉 Yeni Üye!', iconURL: member.user.displayAvatarURL({ size: 64 }) })
        .setDescription(`**${member}** sunucumuza hoş geldin! 🥳\n\n📜 \`!kurallar\` yaz · 🎫 Destek için ticket aç`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setColor(CFG.COLORS.green)
        .addFields(
          { name: '👥 Üye Sayısı', value: `${member.guild.memberCount}`, inline: true },
          { name: '📅 Hesap Tarihi', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: member.guild.name }),
    ],
  }).catch(() => {});
});

client.on('guildMemberRemove', async (member) => {
  if (!CFG.WELCOME_CHANNEL_ID) return;
  const ch = member.guild.channels.cache.get(CFG.WELCOME_CHANNEL_ID);
  if (!ch) return;
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setAuthor({ name: '👋 Bir Üye Ayrıldı', iconURL: member.user.displayAvatarURL({ size: 64 }) })
        .setDescription(`**${member.user.tag}** aramızdan ayrıldı. Görüşmek üzere!`)
        .setColor(CFG.COLORS.red)
        .addFields({ name: '👥 Üye Sayısı', value: `${member.guild.memberCount}`, inline: true })
        .setTimestamp()
        .setFooter({ text: member.guild.name }),
    ],
  }).catch(() => {});
});

// ════════════════════════════════════════════════
//  HATA YÖNETİMİ & GİRİŞ
// ════════════════════════════════════════════════
client.on('error', err => console.error('[Discord Error]', err));
process.on('unhandledRejection', err => console.error('[Unhandled Rejection]', err));

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('❌ DISCORD_TOKEN tanımlı değil!');
client.login(token);
