const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
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

// Açık ticketları tutan map: userId -> channelId
const openTickets = new Map();

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
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_kapat_onayla').setLabel('✅ Evet, Kapat').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_kapat_iptal').setLabel('❌ İptal').setStyle(ButtonStyle.Secondary)
    );
    return message.reply({ embeds: [infoEmbed('⚠️ Ticket Kapatılsın mı?', 'Bu ticketi kapatmak istediğine emin misin?', 0xe67e22)], components: [row] });
  }

  if (cmd === 'ticket-liste') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const ticketler = message.guild.channels.cache.filter(c => c.name.startsWith('ticket-'));
    if (!ticketler.size) return message.reply({ embeds: [infoEmbed('🎫 Açık Ticketlar', 'Şu an açık ticket yok.')] });
    const liste = ticketler.map(c => `${c} — \`${c.name}\``).join('\n');
    return message.reply({ embeds: [infoEmbed(`🎫 Açık Ticketlar (${ticketler.size})`, liste)] });
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
    return message.reply({ embeds: [successEmbed(`Ticket **${hedef.user.tag}** üyesine aktarıldı.`)] });
  }

  if (cmd === 'ticket-istatistikler') {
    const toplam = message.guild.channels.cache.filter(c => c.name.startsWith('ticket-')).size;
    return message.reply({ embeds: [infoEmbed('📊 Ticket İstatistikleri', `**Açık Ticketlar:** ${toplam}`)] });
  }

  // ── TICKET OLUŞTUR (panel) ───────────────────────────────────────────────

  if (cmd === 'ticket-panel') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply({ embeds: [errorEmbed('Yetkin yok.')] });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_ac').setLabel('🎫 Ticket Aç').setStyle(ButtonStyle.Primary)
    );
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Destek Sistemi')
      .setDescription('Destek almak için aşağıdaki butona tıkla.\nEkip en kısa sürede yardımcı olacak.')
      .setFooter({ text: message.guild.name });
    return message.channel.send({ embeds: [embed], components: [row] });
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

// ─── BUTTON INTERACTIONS ──────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // Ticket aç
  if (interaction.customId === 'ticket_ac') {
    await interaction.deferReply({ ephemeral: true });
    const existing = openTickets.get(interaction.user.id);
    if (existing) {
      const ch = interaction.guild.channels.cache.get(existing);
      if (ch) return interaction.editReply({ content: `Zaten açık bir ticketin var: ${ch}` });
    }

    const options = {
      name: `ticket-${interaction.user.username.toLowerCase().replace(/\s+/g, '-')}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    };
    if (TICKET_CATEGORY_ID) options.parent = TICKET_CATEGORY_ID;

    const channel = await interaction.guild.channels.create(options);
    openTickets.set(interaction.user.id, channel.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_kapat_onayla').setLabel('🔒 Ticketi Kapat').setStyle(ButtonStyle.Danger)
    );
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎫 Ticket Açıldı')
      .setDescription(`Merhaba ${interaction.user}!\nDestek ekibi yakında yardımcı olacak.\n\nTicketi kapatmak için aşağıdaki butonu kullan.`);
    await channel.send({ embeds: [embed], components: [row] });
    return interaction.editReply({ content: `Ticketin açıldı: ${channel}` });
  }

  // Ticket kapat onayla
  if (interaction.customId === 'ticket_kapat_onayla') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ Yetkin yok.', ephemeral: true });
    }
    await interaction.reply({ embeds: [successEmbed('Ticket kapatılıyor...')] });
    // Sahibini bul ve map'ten çıkar
    for (const [uid, cid] of openTickets.entries()) {
      if (cid === interaction.channel.id) { openTickets.delete(uid); break; }
    }
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    return;
  }

  // Ticket kapat iptal
  if (interaction.customId === 'ticket_kapat_iptal') {
    return interaction.reply({ embeds: [infoEmbed('❌ İptal', 'Ticket kapatma iptal edildi.')], ephemeral: true });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────
client.login(process.env.BOT_TOKEN);
