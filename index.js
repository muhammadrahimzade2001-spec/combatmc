const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, AttachmentBuilder
} = require('discord.js');
const fs = require('fs');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const PREFIX = '!';
const TOKEN = 'BOT_TOKEN_BURAYA';          // .env ile de kullanabilirsin
const TICKET_CATEGORY_ID = '';             // Ticket kategorisi ID (opsiyonel)
const LOG_CHANNEL_ID = '';                 // Log kanalı ID (opsiyonel)
// ──────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ─── TİCKET VERİ DEPOSU ───────────────────────────────────────────────────
// userId -> { channelId, category, subject, claimedBy, openedAt, ticketNumber }
const openTickets  = new Map();
// channelId -> userId (ters arama)
const channelOwner = new Map();
// Toplam ticket sayacı (kalıcılık için JSON'a yazılabilir)
let ticketCounter = 0;
const COUNTER_FILE = './ticket_counter.json';
try { ticketCounter = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).count || 0; } catch {}
function saveCounter() { fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: ticketCounter })); }

// Ticket kategorileri (isim, emoji, açıklama, renk)
const TICKET_CATEGORIES = [
  { id: 'genel',    label: 'Genel Destek',    emoji: '💬', desc: 'Genel sorular için',         color: 0x5865F2 },
  { id: 'satin',    label: 'Satın Alma',       emoji: '🛒', desc: 'Satın alma & ödeme sorunları',color: 0x2ecc71 },
  { id: 'sikayet',  label: 'Şikayet',          emoji: '⚠️', desc: 'Kullanıcı şikayeti bildir.',    color: 0xe74c3c },
  { id: 'ortak',    label: 'Ortaklık',         emoji: '🤝', desc: 'İş birliği & ortaklık teklifi.',color: 0xf39c12 },
  { id: 'teknik',   label: 'Teknik Destek',    emoji: '🔧', desc: 'Teknik sorunlar için',       color: 0x1abc9c },
];

// ─── YARDIMCI FONKSİYONLAR ────────────────────────────────────────────────

function log(guild, embed) {
  if (!LOG_CHANNEL_ID) return;
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function errorEmbed(desc) {
  return new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ ${desc}`);
}
function successEmbed(desc) {
  return new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ ${desc}`);
}
function infoEmbed(title, desc, color = 0x3498db) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);
}

function getMember(guild, query) {
  if (!query) return null;
  const id = query.replace(/[<@!>]/g, '');
  return guild.members.cache.get(id) || guild.members.cache.find(m =>
    m.user.username.toLowerCase() === query.toLowerCase() ||
    m.displayName.toLowerCase() === query.toLowerCase()
  ) || null;
}

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const v = parseInt(match[1]);
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return v * units[match[2]];
}

// ─── READY ────────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} aktif!`);
  client.user.setActivity(`${PREFIX}yardim`, { type: 3 });
});

// ─── MESSAGE CREATE ───────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ── SUNUCU YÖNETİM ──────────────────────────────────────────────────────

  if (cmd === 'aktif') {
    // Sunucudaki aktif üye sayısı
    const online = message.guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;
    const total  = message.guild.memberCount;
    return message.reply({ embeds: [infoEmbed('📊 Aktif Üyeler', `**Online:** ${online}\n**Toplam:** ${total}`)] });
  }

  if (cmd === 'bakim') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const durum = args[0];
    if (!durum) return message.reply({ embeds: [errorEmbed('Kullanım: `!bakim <ac/kapat>`')] });
    if (durum === 'ac') {
      client.user.setActivity('🔧 Bakım Modu', { type: 3 });
      return message.reply({ embeds: [successEmbed('Bakım modu **açıldı**.')] });
    } else {
      client.user.setActivity(`${PREFIX}yardim`, { type: 3 });
      return message.reply({ embeds: [successEmbed('Bakım modu **kapatıldı**.')] });
    }
  }

  if (cmd === 'oyuncu-sayisi') {
    const count = message.guild.members.cache.filter(m => !m.user.bot).size;
    return message.reply({ embeds: [infoEmbed('🎮 Oyuncu Sayısı', `Sunucuda **${count}** oyuncu bulunuyor.`)] });
  }

  if (cmd === 'duyuru') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const kanal = message.mentions.channels.first();
    const icerik = args.slice(1).join(' ');
    if (!kanal || !icerik) return message.reply({ embeds: [errorEmbed('Kullanım: `!duyuru #kanal <mesaj>`')] });
    await kanal.send({ embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle('📢 Duyuru').setDescription(icerik).setTimestamp()] });
    return message.reply({ embeds: [successEmbed(`Duyuru **${kanal}** kanalına gönderildi.`)] });
  }

  // ── ETKİNLİK & TOPLULUK ──────────────────────────────────────────────────

  if (cmd === 'oneri') {
    const icerik = args.join(' ');
    if (!icerik) return message.reply({ embeds: [errorEmbed('Kullanım: `!oneri <öneri metni>`')] });
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('💡 Yeni Öneri')
      .setDescription(icerik)
      .addFields({ name: 'Öneren', value: `${message.author}` })
      .setTimestamp();
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react('✅');
    await msg.react('❌');
    return message.delete().catch(() => {});
  }

  if (cmd === 'cekilis-baslat') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageEvents)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const sure = args[0];
    const odul = args.slice(1).join(' ');
    if (!sure || !odul) return message.reply({ embeds: [errorEmbed('Kullanım: `!cekilis-baslat <süre: 1m/1h/1d> <ödül>`')] });
    const ms = parseDuration(sure);
    if (!ms) return message.reply({ embeds: [errorEmbed('Geçersiz süre. Örnek: `30m`, `2h`, `1d`')] });
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🎉 ÇEKİLİŞ BAŞLADI!')
      .setDescription(`**Ödül:** ${odul}\n**Süre:** ${sure}\n\n🎊 Katılmak için aşağıya tepki ver!`)
      .setTimestamp(Date.now() + ms);
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react('🎉');
    setTimeout(async () => {
      const fetched = await msg.fetch();
      const reaction = fetched.reactions.cache.get('🎉');
      if (!reaction) return;
      const users = await reaction.users.fetch();
      const katilimcilar = users.filter(u => !u.bot);
      if (!katilimcilar.size) return msg.reply({ embeds: [errorEmbed('Çekilişe kimse katılmadı.')] });
      const kazanan = katilimcilar.random();
      msg.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle('🏆 Çekiliş Bitti!').setDescription(`Tebrikler ${kazanan}! **${odul}** kazandın! 🎉`).setTimestamp()] });
    }, ms);
    return message.reply({ embeds: [successEmbed(`Çekiliş başladı! **${sure}** sonra sonuçlanacak.`)] });
  }

  if (cmd === 'hata-bildir') {
    const icerik = args.join(' ');
    if (!icerik) return message.reply({ embeds: [errorEmbed('Kullanım: `!hata-bildir <hata açıklaması>`')] });
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle('🐛 Hata Bildirimi').setDescription(icerik).addFields({ name: 'Bildiren', value: `${message.author}` }).setTimestamp();
    if (LOG_CHANNEL_ID) {
      const logCh = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logCh) logCh.send({ embeds: [embed] });
    }
    return message.reply({ embeds: [successEmbed('Hatan iletildi, teşekkürler!')] });
  }

  // ── MODERASYON ───────────────────────────────────────────────────────────

  if (cmd === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    if (!hedef) return message.reply({ embeds: [errorEmbed('Üye bulunamadı.')] });
    const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    await hedef.ban({ reason: sebep });
    return message.reply({ embeds: [successEmbed(`**${hedef.user.tag}** banlandı. Sebep: ${sebep}`)] });
  }

  if (cmd === 'unban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const userId = args[0]?.replace(/[<@!>]/g, '');
    if (!userId) return message.reply({ embeds: [errorEmbed('Kullanım: `!unban <kullanıcı ID>`')] });
    await message.guild.members.unban(userId).catch(() => {});
    return message.reply({ embeds: [successEmbed(`**${userId}** banı kaldırıldı.`)] });
  }

  if (cmd === 'kick') {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    if (!hedef) return message.reply({ embeds: [errorEmbed('Üye bulunamadı.')] });
    const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    await hedef.kick(sebep);
    return message.reply({ embeds: [successEmbed(`**${hedef.user.tag}** sunucudan atıldı. Sebep: ${sebep}`)] });
  }

  if (cmd === 'mute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    const sure = args[1];
    if (!hedef || !sure) return message.reply({ embeds: [errorEmbed('Kullanım: `!mute <üye> <süre: 1m/1h/1d>`')] });
    const ms = parseDuration(sure);
    if (!ms) return message.reply({ embeds: [errorEmbed('Geçersiz süre. Örnek: `10m`, `1h`')] });
    await hedef.timeout(ms, args.slice(2).join(' ') || 'Sebep belirtilmedi');
    return message.reply({ embeds: [successEmbed(`**${hedef.user.tag}** ${sure} susturuldu.`)] });
  }

  if (cmd === 'unmute') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    if (!hedef) return message.reply({ embeds: [errorEmbed('Üye bulunamadı.')] });
    await hedef.timeout(null);
    return message.reply({ embeds: [successEmbed(`**${hedef.user.tag}** susturması kaldırıldı.`)] });
  }

  if (cmd === 'warn') {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    const sebep = args.slice(1).join(' ');
    if (!hedef || !sebep) return message.reply({ embeds: [errorEmbed('Kullanım: `!warn <üye> <sebep>`')] });
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xf39c12).setTitle('⚠️ Uyarı').setDescription(`**${hedef.user.tag}** uyarıldı.\n**Sebep:** ${sebep}`)] });
  }

  if (cmd === 'waro') {
    // warn override - uyarıyı sil (basit implementasyon)
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    return message.reply({ embeds: [successEmbed('Uyarı kaldırıldı (log sistemine bağlayın).')] });
  }

  if (cmd === 'karaliste') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    const sebep = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    if (!hedef) return message.reply({ embeds: [errorEmbed('Üye bulunamadı.')] });
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x2c3e50).setTitle('🚫 Kara Listeye Eklendi').setDescription(`**${hedef.user.tag}** kara listeye eklendi.\n**Sebep:** ${sebep}`)] });
  }

  if (cmd === 'purge' || cmd === 'sil') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const adet = parseInt(args[0]);
    if (isNaN(adet) || adet < 1 || adet > 100) return message.reply({ embeds: [errorEmbed('1-100 arası bir sayı gir.')] });
    await message.channel.bulkDelete(adet + 1, true).catch(() => {});
    const bilgi = await message.channel.send({ embeds: [successEmbed(`**${adet}** mesaj silindi.`)] });
    setTimeout(() => bilgi.delete().catch(() => {}), 3000);
    return;
  }

  if (cmd === 'slow') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const saniye = parseInt(args[0]);
    if (isNaN(saniye) || saniye < 0) return message.reply({ embeds: [errorEmbed('Geçerli bir saniye değeri gir. (0 = kapat)')] });
    await message.channel.setRateLimitPerUser(saniye);
    return message.reply({ embeds: [successEmbed(saniye === 0 ? 'Yavaş mod kapatıldı.' : `Yavaş mod **${saniye}s** olarak ayarlandı.`)] });
  }

  if (cmd === 'rol-al') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    const rol = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
    if (!hedef || !rol) return message.reply({ embeds: [errorEmbed('Kullanım: `!rol-al <üye> <@rol>`')] });
    await hedef.roles.remove(rol);
    return message.reply({ embeds: [successEmbed(`**${hedef.user.tag}** üyesinden **${rol.name}** rolü alındı.`)] });
  }

  if (cmd === 'kiliti-ac') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true });
    return message.reply({ embeds: [successEmbed('Kanal kilidi **açıldı**.')] });
  }

  // ── KULLANICI BİLGİ ──────────────────────────────────────────────────────

  if (cmd === 'whois' || cmd === 'userinfo') {
    const hedef = getMember(message.guild, args[0]) || message.member;
    const u = hedef.user;
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`👤 ${u.tag}`)
      .setThumbnail(u.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: u.id, inline: true },
        { name: 'Hesap Oluşturma', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Sunucuya Katılma', value: `<t:${Math.floor(hedef.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Roller', value: hedef.roles.cache.filter(r => r.id !== message.guild.id).map(r => `${r}`).join(', ') || 'Yok' }
      )
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  if (cmd === 'sahipler') {
    const sahip = await message.guild.fetchOwner();
    return message.reply({ embeds: [infoEmbed('👑 Sunucu Sahibi', `${sahip.user.tag} (${sahip.id})`)] });
  }

  if (cmd === 'serverinfo') {
    const g = message.guild;
    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle(`🖥️ ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: 'ID', value: g.id, inline: true },
        { name: 'Üye Sayısı', value: `${g.memberCount}`, inline: true },
        { name: 'Kanal Sayısı', value: `${g.channels.cache.size}`, inline: true },
        { name: 'Kuruluş', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Boost', value: `Tier ${g.premiumTier} (${g.premiumSubscriptionCount} boost)`, inline: true }
      )
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  if (cmd === 'mod-kayit') {
    // Mod işlemlerini loglar (log kanalını ayarla)
    return message.reply({ embeds: [infoEmbed('📋 Mod Kayıt', `Log kanalı: ${LOG_CHANNEL_ID ? `<#${LOG_CHANNEL_ID}>` : 'Ayarlanmamış'}\nKayıt açık.`)] });
  }

  // ── TİCKET SİSTEMİ ───────────────────────────────────────────────────────

  if (cmd === 'ticket-kapat') {
    if (!message.channel.name.startsWith('ticket-')) return message.reply({ embeds: [errorEmbed('Bu kanal bir ticket kanalı değil.')] });
    const isOwner = channelOwner.get(message.channel.id) === message.author.id;
    const isMod   = message.member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!isOwner && !isMod) return message.reply({ embeds: [errorEmbed('Bu ticketi kapatma yetkin yok.')] });
    await sendCloseConfirm(message.channel, message.author);
    return;
  }

  if (cmd === 'ticket-liste') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    if (!openTickets.size) return message.reply({ embeds: [infoEmbed('🎫 Açık Ticketlar', 'Şu an açık ticket yok.')] });
    const rows = [];
    for (const [uid, data] of openTickets.entries()) {
      const ch = message.guild.channels.cache.get(data.channelId);
      const cat = TICKET_CATEGORIES.find(c => c.id === data.category);
      rows.push(`${cat?.emoji || '🎫'} ${ch || `#${data.channelId}`} — **${data.subject || 'Konu yok'}** ${data.claimedBy ? `(📌 <@${data.claimedBy}>)` : ''}`);
    }
    return message.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`🎫 Açık Ticketlar — ${openTickets.size}`).setDescription(rows.join('\n')).setTimestamp()] });
  }

  if (cmd === 'ticket-sil') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    if (!message.channel.name.startsWith('ticket-')) return message.reply({ embeds: [errorEmbed('Bu kanal bir ticket kanalı değil.')] });
    await message.channel.delete().catch(() => {});
    return;
  }

  if (cmd === 'ticket-aktar') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const hedef = getMember(message.guild, args[0]);
    if (!hedef) return message.reply({ embeds: [errorEmbed('Üye bulunamadı.')] });
    await message.channel.permissionOverwrites.edit(hedef.id, { ViewChannel: true, SendMessages: true });
    return message.reply({ embeds: [successEmbed(`Ticket ${hedef} üyesine aktarıldı.`)] });
  }

  if (cmd === 'ticket-istatistikler') {
    const acik   = openTickets.size;
    const toplam = ticketCounter;
    const embed  = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 Ticket İstatistikleri')
      .addFields(
        { name: '🟢 Açık',  value: `${acik}`,           inline: true },
        { name: '📁 Toplam',value: `${toplam}`,          inline: true },
        { name: '🔴 Kapalı',value: `${toplam - acik}`,   inline: true },
      )
      .setTimestamp();
    const catStats = TICKET_CATEGORIES.map(c => {
      const count = [...openTickets.values()].filter(t => t.category === c.id).length;
      return `${c.emoji} **${c.label}:** ${count}`;
    });
    embed.addFields({ name: 'Kategori Dağılımı', value: catStats.join('\n') || 'Veri yok' });
    return message.reply({ embeds: [embed] });
  }

  // ── TICKET PANEL ────────────────────────────────────────────────────────
  if (cmd === 'ticket-panel') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    await sendTicketPanel(message.channel, message.guild);
    return message.reply({ embeds: [successEmbed('Ticket paneli gönderildi!')] });
  }

  // ── YARDIM ───────────────────────────────────────────────────────────────

  if (cmd === 'yardim' || cmd === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📖 Komut Listesi — Prefix: \`${PREFIX}\``)
      .addFields(
        {
          name: '🖥️ Sunucu Yönetimi',
          value: '`aktif` `bakim` `oyuncu-sayisi` `duyuru #kanal <mesaj>`',
        },
        {
          name: '🎉 Etkinlik & Topluluk',
          value: '`oneri <metin>` `cekilis-baslat <süre> <ödül>` `hata-bildir <açıklama>`',
        },
        {
          name: '🔨 Moderasyon',
          value: '`ban` `unban` `kick` `mute` `unmute` `warn` `waro` `karaliste` `purge` `slow` `rol-al` `kiliti-ac`',
        },
        {
          name: '👤 Kullanıcı Bilgi',
          value: '`whois` `userinfo` `sahipler` `serverinfo` `mod-kayit`',
        },
        {
          name: '🎫 Ticket',
          value: '`ticket-panel` `ticket-kapat` `ticket-liste` `ticket-sil` `ticket-aktar` `ticket-istatistikler`',
        },
      )
      .setFooter({ text: 'Tüm komutlarda üye = @mention veya kullanıcı adı' });
    return message.reply({ embeds: [embed] });
  }
});

// ─── TİCKET YARDIMCI FONKSİYONLARI ──────────────────────────────────────

async function sendTicketPanel(channel, guild) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎫 Destek Merkezi')
    .setDescription(
      '> Aşağıdan uygun kategoriyi seçerek destek talebi oluşturabilirsin.\n> Ekibimiz en kısa sürede yardımcı olacaktır.\n\n' +
      TICKET_CATEGORIES.map(c => `${c.emoji} **${c.label}** — ${c.desc}`).join('\n')
    )
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setFooter({ text: `${guild.name} • Destek Sistemi`, iconURL: guild.iconURL() })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_kategori')
    .setPlaceholder('📂 Kategori seç...')
    .addOptions(
      TICKET_CATEGORIES.map(c =>
        new StringSelectMenuOptionBuilder()
          .setLabel(c.label)
          .setDescription(c.desc)
          .setEmoji(c.emoji)
          .setValue(c.id)
      )
    );

  const row = new ActionRowBuilder().addComponents(menu);
  return channel.send({ embeds: [embed], components: [row] });
}

async function sendCloseConfirm(channel, requester) {
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('🔒 Ticket Kapatılsın mı?')
    .setDescription(`${requester} tarafından kapatma isteği gönderildi.\nTranscript alınarak ticket kapatılacak.`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_kapat_onayla').setLabel('✅ Kapat & Transcript Al').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_kapat_iptal').setLabel('❌ İptal').setStyle(ButtonStyle.Secondary)
  );
  return channel.send({ embeds: [embed], components: [row] });
}

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted   = [...messages.values()].reverse();
  const lines    = sorted.map(m =>
    `[${new Date(m.createdTimestamp).toLocaleString('tr-TR')}] ${m.author.tag}: ${m.content || '[Embed/Dosya]'}`
  );
  const content = `=== TICKET TRANSCRIPT ===\nKanal: #${channel.name}\nTarih: ${new Date().toLocaleString('tr-TR')}\n${'═'.repeat(40)}\n\n${lines.join('\n')}`;
  return Buffer.from(content, 'utf-8');
}

// ─── INTERACTION CREATE ───────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── KATEGORİ SEÇİMİ ────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_kategori') {
    const catId = interaction.values[0];
    const cat   = TICKET_CATEGORIES.find(c => c.id === catId);

    // Zaten açık ticket var mı?
    const existing = openTickets.get(interaction.user.id);
    if (existing) {
      const ch = interaction.guild.channels.cache.get(existing.channelId);
      if (ch) return interaction.reply({ content: `❌ Zaten açık bir ticketin var: ${ch}`, ephemeral: true });
    }

    // Konu girmesi için modal aç
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${catId}`)
      .setTitle(`${cat.emoji} ${cat.label} — Ticket Aç`);

    const konuInput = new TextInputBuilder()
      .setCustomId('ticket_konu')
      .setLabel('Konu')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Sorununu kısaca açıkla...')
      .setMaxLength(80)
      .setRequired(true);

    const aciklamaInput = new TextInputBuilder()
      .setCustomId('ticket_aciklama')
      .setLabel('Açıklama')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Detaylı açıklama yaz... (opsiyonel)')
      .setMaxLength(500)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(konuInput),
      new ActionRowBuilder().addComponents(aciklamaInput),
    );
    return interaction.showModal(modal);
  }

  // ── MODAL SUBMIT ────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
    await interaction.deferReply({ ephemeral: true });
    const catId = interaction.customId.replace('ticket_modal_', '');
    const cat   = TICKET_CATEGORIES.find(c => c.id === catId);
    const konu  = interaction.fields.getTextInputValue('ticket_konu');
    const acik  = interaction.fields.getTextInputValue('ticket_aciklama') || '';

    ticketCounter++;
    saveCounter();
    const num = String(ticketCounter).padStart(4, '0');

    const channelOptions = {
      name: `ticket-${num}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      type: ChannelType.GuildText,
      topic: `🎫 #${num} | ${cat.emoji} ${cat.label} | Konu: ${konu} | Açan: ${interaction.user.tag}`,
      permissionOverwrites: [
        { id: interaction.guild.id,        deny:  [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id,         allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    };
    if (TICKET_CATEGORY_ID) channelOptions.parent = TICKET_CATEGORY_ID;

    const channel = await interaction.guild.channels.create(channelOptions);

    // Veriye kaydet
    const data = {
      channelId: channel.id,
      category: catId,
      subject: konu,
      claimedBy: null,
      openedAt: Date.now(),
      ticketNumber: num,
    };
    openTickets.set(interaction.user.id, data);
    channelOwner.set(channel.id, interaction.user.id);

    // Ticket kanalına güzel karşılama mesajı
    const embed = new EmbedBuilder()
      .setColor(cat.color)
      .setTitle(`${cat.emoji} Ticket #${num} — ${cat.label}`)
      .setDescription(
        `Merhaba ${interaction.user}! Ticketin oluşturuldu.\n` +
        `Destek ekibi en kısa sürede yardımcı olacak.\n\n` +
        `**📌 Konu:** ${konu}\n` +
        (acik ? `**📝 Açıklama:** ${acik}\n` : '') +
        `\n⏰ Lütfen bekle, sabırlı ol.`
      )
      .addFields(
        { name: '👤 Ticket Sahibi', value: `${interaction.user}`,                      inline: true },
        { name: '📂 Kategori',      value: `${cat.emoji} ${cat.label}`,                inline: true },
        { name: '🕐 Açılış',        value: `<t:${Math.floor(Date.now()/1000)}:R>`,      inline: true },
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Ticket #${num} • ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_claim').setLabel('📌 Üstlen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_kapat_onayla').setLabel('🔒 Kapat').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
    );

    await channel.send({ content: `${interaction.user} — Destek ekibi: @here`, embeds: [embed], components: [btnRow] });
    return interaction.editReply({ content: `✅ Ticketin açıldı: ${channel}` });
  }

  if (!interaction.isButton()) return;

  // ── TICKET CLAIM ────────────────────────────────────────────────────────
  if (interaction.customId === 'ticket_claim') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ Bu işlem için yetkin yok.', ephemeral: true });
    }
    // Sahibini bul ve güncelle
    const uid = channelOwner.get(interaction.channel.id);
    if (uid) {
      const d = openTickets.get(uid);
      if (d) {
        d.claimedBy = interaction.user.id;
        openTickets.set(uid, d);
      }
    }
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`📌 Bu ticket **${interaction.member.displayName}** tarafından üstlenildi.`)
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ── TICKET TRANSCRIPT ───────────────────────────────────────────────────
  if (interaction.customId === 'ticket_transcript') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ Yetkin yok.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const buf  = await generateTranscript(interaction.channel);
    const file = new AttachmentBuilder(buf, { name: `transcript-${interaction.channel.name}.txt` });
    return interaction.editReply({ content: '📄 Transcript hazır!', files: [file] });
  }

  // ── TICKET KAPAT ONAYLA ─────────────────────────────────────────────────
  if (interaction.customId === 'ticket_kapat_onayla') {
    const uid    = channelOwner.get(interaction.channel.id);
    const isOwner = uid === interaction.user.id;
    const isMod   = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (!isOwner && !isMod) return interaction.reply({ content: '❌ Yetkin yok.', ephemeral: true });

    await interaction.deferReply();

    // Transcript al
    const buf  = await generateTranscript(interaction.channel);
    const file = new AttachmentBuilder(buf, { name: `transcript-${interaction.channel.name}.txt` });

    // Log kanalına gönder
    if (LOG_CHANNEL_ID) {
      const logCh = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      const data  = uid ? openTickets.get(uid) : null;
      if (logCh) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🔒 Ticket Kapatıldı')
          .addFields(
            { name: 'Kanal',    value: `#${interaction.channel.name}`,        inline: true },
            { name: 'Kapatan', value: `${interaction.user}`,                   inline: true },
            { name: 'Konu',    value: data?.subject || 'Bilinmiyor',           inline: true },
          )
          .setTimestamp();
        logCh.send({ embeds: [logEmbed], files: [file] }).catch(() => {});
      }
    }

    // DM'e transcript
    if (uid) {
      const owner = await interaction.guild.members.fetch(uid).catch(() => null);
      if (owner) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📄 Ticket Transcript — #${interaction.channel.name}`)
          .setDescription(`Ticketin **${interaction.guild.name}** sunucusunda kapatıldı. Transcript ektedir.`)
          .setTimestamp();
        owner.send({ embeds: [dmEmbed], files: [new AttachmentBuilder(buf, { name: `transcript-${interaction.channel.name}.txt` })] }).catch(() => {});
      }
    }

    // Map'ten çıkar
    if (uid) { openTickets.delete(uid); channelOwner.delete(interaction.channel.id); }

    const closeEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔒 Ticket Kapatılıyor')
      .setDescription(`**${interaction.user}** tarafından kapatıldı.\nTranscript DM'ine gönderildi. Kanal 3 saniye içinde silinecek.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [closeEmbed] });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    return;
  }

  // ── TICKET KAPAT İPTAL ──────────────────────────────────────────────────
  if (interaction.customId === 'ticket_kapat_iptal') {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setDescription('❌ Kapatma işlemi iptal edildi.')],
      ephemeral: true
    });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
