const debug = true

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { retrieveBalance } = require('../../sqlite');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('balance')
		.setDescription('Retrieves balance'),

	async execute(interaction) {
        const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
        const userId = interaction.user.id;

        const balance = await retrieveBalance(userId);

        if (debug) console.log(`Balance: ${balance}`);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle(`Your balance: ${balance}🥛`)

        // embed.setFooter({ text: `Balance: ${balance}` });

		await interaction.reply({ embeds: [embed] });
	},
};