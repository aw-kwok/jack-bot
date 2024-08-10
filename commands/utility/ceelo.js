const debug = true

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { retrieveBalance, updateBalance } = require('../../sqlite');
const { joinImages } = require("join-images");

const diceEmoji = [`<:dice1:1271674338344435732>`, `<:dice2:1271674339284222073>`, `<:dice3:1271674340018229333>`, `<:dice4:1271674340873605222>`, `<:dice5:1271674341607735308>`, `<:dice6:1271674342492733514>`];

/**
 * Creates a hand of three dice
 * 
 * @returns {Array.<number>} - hand of dice
 */
function createHand() {
    let hand = new Array();
    for (let i = 0; i < 3; i++) {
        hand[i] = Math.floor(Math.random() * 6) + 1;
    }
    return hand;
}

/**
 * Calculates the amount of points for a hand. Returns -1 for invalid hand.
 * 
 * @param {Array.<number>} hand - hand of dice
 * @returns {number} - points
 */
function calculatePoints(hand) {
    // MIGHT WANT TO SEND EMBED THROUGH
    let map = new Array(6).fill(0);
    for (let i = 0; i < hand.length; i++) {
        map[hand[i]-1]++;
    }

    if(debug) console.log(`Map: ${map}`);

    let points = -1;
    let pair = false;

    // 4-5-6
    if (hand[3] === 1 && hand[4] === 1 && hand[5] === 1) {
        return 6;
    }

    // 1-2-3
    if (hand[0] === 1 && hand[1] === 1 && hand[2] === 1) {
        return 1;
    }

    for (let i = 0; i < map.length; i++) {
        if (map[i] === 0) {
            continue;
        }
        // trips check
        else if (map[i] === 3) {
            return 6;
        }
        else if (map[i] === 2){
            if (points !== -1) {
                return points;
            }
            pair = true;
        }
        else {
            if (points !== -1) {
                // if there are two singles, the hand is indeterminate
                return -1;
            }
            else if (pair == true) {
                // pair already seen, points is the new total (pair before points)
                return i + 1;
            }
            else {
                points = i + 1;
            }
        }
    }
}


module.exports = {
	data: new SlashCommandBuilder()
		.setName('ceelo')
		.setDescription('Play Cee-lo!')
        .addNumberOption(option =>
            option.setName("wager")
                .setDescription("How much you want to wager")
                .setRequired(true)
                .setMinValue(1)),

	async execute(interaction) {
        if (debug) console.log("In ceelo:")

        const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
        const userId = interaction.user.id;

        let balance = await retrieveBalance(userId);
        const wager = interaction.options.getNumber("wager");

        if (debug) console.log(`Balance: ${balance}`);
        if (debug) console.log(`Wager: ${wager}`);

        if (wager > balance) {
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({
                    name: name,
                    iconURL: avatar
                })
                .setTitle("Not enough money")
                .setDescription(`You don't have enough money to wager this amount!`)
                .setFooter({ text: `Balance: ${balance}🥛` })
            ]})
            return;
        }

        const dealerHand = await createHand();
        const dealerPoints = await calculatePoints(dealerHand);

        const img = await joinImages([`./assets/dice${dealerHand[0]}.png`, `./assets/dice${dealerHand[1]}.png`, `./assets/dice${dealerHand[2]}.png`], {
            direction: "horizontal",
            offset: 10,
            color: {
                alpha: 0,
                r: 0,
                g: 0,
                b: 0
            }
        })
        await img.toFile("./temp/ceelo-dealerhand.png");

        if (debug) console.log(`Dealer hand: ${dealerHand}`)
        if (debug) console.log(`Dealer hand points: ${dealerPoints}`)
        
        const attachment = new AttachmentBuilder('./temp/ceelo-dealerhand.png');

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setImage("attachment://ceelo-dealerhand.png")

        // let wagerDisplay;

        // // update user balance
        // if (input === result) {
        //     embed.setTitle(`You win!`);
        //     wagerDisplay = `**+${wager}:milk:**`
        //     balance = await updateBalance(userId, wager);
        // }
        // else {
        //     embed.setTitle(`You lose.`);
        //     wagerDisplay = `**-${wager}:milk:**`
        //     balance = await updateBalance(userId, -wager);
        // }

        // embed.setDescription(`The coin landed on **${result}**\n${wagerDisplay}`);
        embed.setFooter({ text: `Balance: ${balance}🥛` });
        

        
        // // handle thumbnail
        // const file = (result === "heads") ? new AttachmentBuilder("./assets/heads.png") : new AttachmentBuilder("./assets/tails.png");

        // if(result === "heads") {
        //     embed.setThumbnail("attachment://heads.png");
        // }
        // else {
        //     embed.setThumbnail("attachment://tails.png");
        // }

		await interaction.reply({ embeds: [embed], files: [attachment] });
    },
};