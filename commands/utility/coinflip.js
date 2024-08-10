const debug = true

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { retrieveBalance, updateBalance } = require('../../sqlite');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('coinflip')
		.setDescription('Flips a coin!')
        .addStringOption(option => 
            option.setName("selection")
                .setDescription("Heads or tails")
                .addChoices(
                    { name: "heads", value: "heads"},
                    { name: "tails", value: "tails"}
                )
                .setRequired(true))
        .addNumberOption(option =>
            option.setName("wager")
                .setDescription("How much you want to wager")
                .setRequired(true)
                .setMinValue(1)),

	async execute(interaction) {
        if (debug) console.log("In coinflip:")

        const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
        const userId = interaction.user.id;

        const balance = await retrieveBalance(userId);
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

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const input = interaction.options.getString("selection");

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
        
        let wagerDisplay;

        // update user balance
        if (input === result) {
            embed.setTitle(`You win!`);
            wagerDisplay = `**+${wager}:milk:**`
            await updateBalance(userId, wager);
        }
        else {
            embed.setTitle(`You lose.`);
            wagerDisplay = `**-${wager}:milk:**`
            await updateBalance(userId, -wager);
        }

        embed.setDescription(`The coin landed on **${result}**\n${wagerDisplay}`);

        const newBalance = await retrieveBalance(userId);
        embed.setFooter({ text: `Balance: ${newBalance}🥛` });
        
        // handle thumbnail
        const file = (result === "heads") ? new AttachmentBuilder("./assets/heads.png") : new AttachmentBuilder("./assets/tails.png");

        if(result === "heads") {
            embed.setThumbnail("attachment://heads.png");
        }
        else {
            embed.setThumbnail("attachment://tails.png");
        }

		await interaction.reply({ embeds: [embed], files: [file] });
	},
};