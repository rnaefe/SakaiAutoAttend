const { Builder, By, Key } = require('selenium-webdriver');
const schedule = require('node-schedule');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const dersDosyasi = './ders.json';
let config;

try {
    const data = fs.readFileSync(dersDosyasi, 'utf8');
    config = JSON.parse(data);
} catch (err) {
    console.error('JSON dosyası okunurken hata oluştu:', err);
    process.exit(1);
}

const { kullaniciAdi, sifre, dersler, telegram_bot_token, chatId } = config;

const bot = new TelegramBot(telegram_bot_token, { polling: true });

async function joinClass(ders) {
    const username = kullaniciAdi;
    const password = sifre;

    let driver = await new Builder().forBrowser('chrome').build();

    try {
        await driver.get('https://online.deu.edu.tr');
        await driver.findElement(By.id('eid')).sendKeys(username);
        await driver.findElement(By.id('pw')).sendKeys(password, Key.RETURN);

        await driver.sleep(2000);
        await driver.get(ders.derslink);

        await driver.sleep(2000);
        const onlineClass = await driver.findElement(By.xpath("//a[@title='Toplantı detaylarını görüntülemek için tıklayınız']"));
        await onlineClass.click();

        await driver.sleep(2000);
        const joinButton = await driver.findElement(By.id('joinMeetingLink'));
        await joinButton.click();

        console.log(`${ders.dersadi} dersi açıldı: ${new Date().toLocaleString()}`);
        bot.sendMessage(chatId, `${ders.dersadi} dersi başarıyla açıldı.`);

        ders.driver = driver;
    } catch (error) {
        console.error(`${ders.dersadi} dersi açılırken hata oluştu:`, error);
        bot.sendMessage(chatId, `${ders.dersadi} dersi açılırken bir hata oluştu: ${error.message}`);
        await driver.quit();
    }
}

async function endClass(ders) {
    try {
        if (ders.driver) {
            await ders.driver.quit();
            console.log(`${ders.dersadi} dersi kapatıldı: ${new Date().toLocaleString()}`);
            bot.sendMessage(chatId, `${ders.dersadi} dersi başarıyla kapatıldı.`);
        } else {
            console.log(`${ders.dersadi} için aktif bir oturum bulunamadı.`);
            bot.sendMessage(chatId, `${ders.dersadi} için aktif bir oturum bulunamadı.`);
        }
    } catch (error) {
        console.error(`${ders.dersadi} dersi kapatılırken hata oluştu:`, error);
        bot.sendMessage(chatId, `${ders.dersadi} dersi kapatılırken bir hata oluştu: ${error.message}`);
    }
}

dersler.forEach(ders => {
    const [startHour, startMinute] = ders.derssaati.split(':').map(Number);
    const [endHour, endMinute] = ders.dersbitissaat.split(':').map(Number);
    const daysOfWeek = ders.gunler.map(day => {
        switch (day.toLowerCase()) {
            case 'pazartesi': return 1;
            case 'salı': return 2;
            case 'çarşamba': return 3;
            case 'perşembe': return 4;
            case 'cuma': return 5;
            default: return null;
        }
    }).filter(day => day !== null);

    schedule.scheduleJob({ hour: startHour, minute: startMinute, dayOfWeek: daysOfWeek }, () => {
        console.log(`${ders.dersadi} dersi başlıyor: ${new Date().toLocaleString()}`);
        bot.sendMessage(chatId, `${ders.dersadi} dersi başlıyor: ${new Date().toLocaleString()}`);
        joinClass(ders);
    });

    schedule.scheduleJob({ hour: endHour, minute: endMinute, dayOfWeek: daysOfWeek }, () => {
        console.log(`${ders.dersadi} dersi bitiyor: ${new Date().toLocaleString()}`);
        endClass(ders);
    });
});


console.log('Ders zamanlayıcı başlatıldı.');
bot.sendMessage(chatId, `Ders zamanlayıcı başlatıldı. ${new Date().toLocaleString()}`);

process.on('SIGINT', async () => {
    await bot.sendMessage(chatId, `Ders zamanlayıcı kapatılıyor. ${new Date().toLocaleString()}`);
    await console.log('Ders zamanlayıcı kapatılıyor.');
    await process.exit();
});

process.on('uncaughtException', async (error) => {
    await console.error('Beklenmeyen bir hata oluştu:', error);
    await bot.sendMessage(chatId, `Beklenmeyen bir hata oluştu: ${error.message}`);
    await process.exit();
});

process.on('unhandledRejection', async (reason, promise) => {
    await console.error('Beklenmeyen bir hata oluştu:', reason);
    await bot.sendMessage(chatId, `Beklenmeyen bir hata oluştu: ${reason.message}`);
    await process.exit();
});

setInterval(() => {
    bot.sendMessage(chatId, `Ders zamanlayıcısı aktif. ${new Date().toLocaleString()}`);
}, 1000 * 60 * 30); // 30 dakikada bir botun aktif olduğunu belirtmek için