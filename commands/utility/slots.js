const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { retrieveBalance, updateBalance } = require('../../sqlite');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('slots')
		.setDescription('Spin the Slots!')
        .addNumberOption(option =>
            option.setName("wager")
                .setDescription("How much you want to wager")
                .setRequired(true)
                .setMinValue(1)),

	async execute(interaction) {
        const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
        const userId = interaction.user.id;
        const userBal = await retrieveBalance(userId);

        if (userBal < 5) {
            const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle("Not enough money")
            .setDescription(`You don't have enough money to wager this amount!`)
            .setFooter({ text: `Balance: ${balance}🥛` })

		    await interaction.reply({ embeds: [embed]});
            return;
        }

        const icons = [
            ':cherries:', ':tangerine:', ":seven:", ':turtle:', ':apple:', 
            ':blueberries:', ':bell:', ':coin:', ':four_leaf_clover:', ':star:', 
            ':pear:', ':watermelon:',':lemon:', ':crown:', ':gem:' 
        ]

        const numbers = [
            Math.floor(Math.random() * icons.length),
            Math.floor(Math.random() * icons.length),
            Math.floor(Math.random() * icons.length),
            Math.floor(Math.random() * icons.length),
            Math.floor(Math.random() * icons.length)
        ]

        const frequency = {};
        numbers.forEach(num => {
            frequency[num] = (frequency[num] || 0 ) + 1;
        });

        let maxFrequency = 0;
        for (let key in frequency) {
            if (frequency[key] > maxFrequency) {
                maxFrequency = frequency[key]
            }
        }
        //console.log(frequency)
        //console.log(maxFrequency)

        let payout = -5;
        if (maxFrequency === 3) {
            payout = 10;
        } else if (maxFrequency === 4) {
            payout = 300;
        } else if (maxFrequency === 5) {
            payout = 10000;
        }
        
        const newBalance = await updateBalance(userId, payout);
        const payoutSymbol = (payout < 0) ? "" : "+";

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle((payout > 0) ? `You win!` : `You lose.`)
            .setDescription(` ${icons[numbers[0]]} | ${icons[numbers[1]]} | ${icons[numbers[2]]} |  ${icons[numbers[3]]} |  ${icons[numbers[4]]} \n\n**${payoutSymbol}${payout}:milk:**`)
            .setFooter({ text: `Balance: ${newBalance}🥛` })

		await interaction.reply({ embeds: [embed]});
	},
};