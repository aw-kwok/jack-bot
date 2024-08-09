const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { retrieveBalance, updateBalance } = require('../../sqlite');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hacks')
		.setDescription('Duping Money')
        .addNumberOption(option =>
            option.setName("money")
                .setDescription("How much do you want to dupe?")
                .setRequired(true)),

	async execute(interaction) {
        const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
        const userId = interaction.user.id;

        const input = interaction.options.getNumber("money")
        await updateBalance(userId, input)
        const currentBalance = await retrieveBalance(userId)
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle("Duping Money")
            .setDescription(`Added ${input} to your balance.\nYou currently have ${currentBalance}.`)


		await interaction.reply({ embeds: [embed]});
	},
};