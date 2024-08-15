const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { retrieveBalance, updateBalance } = require('../../sqlite');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('Begins running a game of blackjack with the user and the dealer.')
		.addIntegerOption(option =>
			option.setName('bet')
				.setDescription('How much you want to bet on the hand.')
				.setRequired(true)
		),
		
	async execute(interaction) {
		// need to get the user's balance and bet
		const id = interaction.member.id;
		const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();

		let balance = await retrieveBalance(id);
		let betAmount = interaction.options.getInteger('bet');

		// validate bet
		if (betAmount <= 0) {
			await interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({
                    name: name,
                    iconURL: avatar
                })
                .setTitle("Invalid bet")
                .setDescription(`Your bet must be greater than 0!`)
                .setFooter({ text: `Balance: ${balance}🥛` })
            ]})
            return;
		}
		if (betAmount > balance) {
			await interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({
                    name: name,
                    iconURL: avatar
                })
                .setTitle("Not enough money")
                .setDescription(`You're too broke to wager this amount!`)
                .setFooter({ text: `Balance: ${balance}🥛` })
            ]})
            return;
		};

		// instantiate the deck
		const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
		const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		let deck = [];

		suits.forEach(suit => {
			ranks.forEach(rank => {
				deck.push({ suit, rank });
			})
		});

		deck = deck.sort(() => Math.random() - 0.5);

		// instantiate hands
		let playerHand = [];
		let dealerHand = [];

		for (let i = 0; i < 2; i++) {
			playerHand.push(drawCard());
			dealerHand.push(drawCard());
		}

		let playerHandVal = calculateHandValue(playerHand);
		let dealerHandVal = calculateHandValue(dealerHand);

		// set win state
		let win = null

		// embed window should now contain the dealer hand (first card displayed)
		const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle('Blackjack')
            .setDescription(`A ${betAmount}:milk: hand of blackjack.`)
			.addFields(
				{ name: 'Dealer\'s Hand', value: formatHand([dealerHand[0]]) + ', ??', inline: false },
				{ name: 'Your Hand', value: formatHand(playerHand) + `( Total: ${playerHandVal})`, inline: false },
			);

		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('hit')
					.setLabel('Hit')
					.setStyle('Primary'),
				new ButtonBuilder()
					.setCustomId('stand')
					.setLabel('Stand')
					.setStyle('Secondary')
			);
        
		await interaction.reply({ embeds: [embed], components: [row] });

		// let the playing user hit or stand
		const filter = i => i.user.id === interaction.user.id;
		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
		collector.on('collect', async i => {
			let twentyOne = false;
			if (i.customId === 'hit') {
				// hit in player hand
				playerHand.push(drawCard());
				playerHandVal = calculateHandValue(playerHand);
				
				// update embed
				embed.spliceFields(1, 1, { name: 'Your Hand', value: formatHand(playerHand) + ` (Total: ${playerHandVal})`, inline: false });
				
				// check for bust
				if (playerHandVal > 21) {
					embed.setTitle('You busted! Dealer wins.');
					embed.setDescription(' ');
					balance = await updateBalance(id, -betAmount);
					embed.setFooter({ text: `Balance: ${balance}🥛` });
					await i.update({ embeds: [embed], components: [] });
					collector.stop();
				} else if (playerHandVal == 21) {
					twentyOne = true;
				} else {
					await i.update({ embeds: [embed], components: [row] });
				};
			};
			if (i.customId === 'stand' || twentyOne) {
				// end player's turn
				collector.stop();

				// finish dealer hand
				dealerHandVal = finishDealer();
				if (dealerHandVal > 21 || playerHandVal > dealerHandVal) {
					embed.setTitle('You win!');
					embed.setDescription(' ');
					win = true;
					balance = await updateBalance(id, betAmount);
				} else if (playerHandVal < dealerHandVal) {
					embed.setTitle('You lose! Dealer wins.');
					embed.setDescription(' ');
					win = false;
					balance = await updateBalance(id, -betAmount);
				} else {
					embed.setTitle('It\'s a tie! You and the dealer push.');
					embed.setDescription(' ');
				}
				
				embed.setFooter({ text: `Balance: ${balance}🥛` });
				embed.spliceFields(0, 1, { name: 'Dealer\'s Hand', value: formatHand(dealerHand) + ` (Total: ${dealerHandVal})`, inline: false });

				await i.update({ embeds: [embed], components: [] });
			}
		});

		collector.on('end', collected => {
			if (collected.size === 0) {
				embed.setDescription('Game timed out.');
				interaction.editReply({ embeds: [embed], components: [] });
			}
		});
		

		// -------------------------------------------------------

		// FUNCTIONS:
		// drawCard: Draws a card from the deck
		function drawCard() {
			return deck.shift();
		}

		// calculateHandValue(hand): returns the 'hard' and 'soft' value of the hand; soft is -1 if no ace
		function calculateHandValue(hand) {
			let hardVal = 0;
			let aceCount = 0;
		
			hand.forEach(card => {
				if (['J', 'Q', 'K'].includes(card.rank)) {
					hardVal += 10;
				} else if (card.rank === 'A') {
					aceCount += 1;
					hardVal += 11;
				} else {
					hardVal += parseInt(card.rank);
				}
			});
		
			while (hardVal > 21 && aceCount > 0) {
				hardVal -= 10;
				aceCount -= 1;
			}
		
			return hardVal;
		}

		// finishDealer(): finishes the dealer's hand, returning the final value
		function finishDealer() {
			let dealerVal = calculateHandValue(dealerHand);
			while (dealerVal < 16) {
				dealerHand.push(drawCard());
				dealerVal = calculateHandValue(dealerHand);
			}
			return dealerVal;
		}

		// formatHand(hand): formats the hand for display in the embed
		function formatHand(hand) {
			return hand.map(card => `${card.rank} :${card.suit}:`).join(', ');
		}
	},
};