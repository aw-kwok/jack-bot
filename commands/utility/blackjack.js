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
		let userBal = 100; 
		// let userBal = retrieveBalance(id, interaction.user.username);
		let betAmount = interaction.options.getInteger('bet');

		// validate bet
		if (betAmount <=0) {
			return interaction.reply('You must place a valid bet!');
		}
		if (betAmount > userBal) {
			return interaction.reply('Bet amount exceeds your existing funds. You have: ' 
				+ userBal + ':milk: remaining.')
		}

		// initialize embed
		const id = interaction.member.id;
		const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
		const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle('Blackjack')
            .setDescription(`A ${betAmount}:milk: hand of blackjack.`);

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
		embed.addFields(
			{ name: 'Dealer\'s Hand', value: formatHand([dealerHand[0]]), inline: false },
			{ name: 'Your Hand', value: formatHand(playerHand) + `( Total: ${playerHandVal})`, inline: false },
		);

		// let the playing user hit or stand
		const filter = i => i.user.id === interaction.user.id;
		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
		collector.on('collect', async i => {
			if (i.customId === 'hit') {
				// hit in player hand
				playerHand.push(drawCard());
				playerHandVal = calculateHandValue(playerHand);
				
				// update embed
				embed.spliceFields(1, 1, { name: 'Your Hand', value: formatHand(playerHand) + ` (Total: ${playerHandVal})`, inline: false });
				
				// check for bust
				if (playerHandVal > 21) {
					embed.setDescription('You busted! Dealer wins.')
					await i.update({ embeds: [embed], components: [] });
					collector.stop();
				} else {
					await i.update({ embeds: [embed], components: [row] });
				}
			} else if (i.customId === 'stand') {
				// end player's turn
				collector.stop();

				// finish dealer hand
				dealerHandVal = finishDealer();
				if (dealerHandVal > 21 || playerHandVal > dealerHandVal) {
					embed.setDescription('You win!');
					win = true;
				} else if (playerHandVal < dealerHandVal) {
					embed.setDescription('You lose! Dealer wins.');
					win = false;
				} else {
					embed.setDescription('It\'s a tie! You and the dealer push.');
				}

				embed.spliceFields(0, 1, { name: 'Dealer\'s Hand', value: `${dealerFinalHand} (Total: ${dealerVal[0]})`, inline: false });

				await i.update({ embeds: [embed], components: [] });
			}
		});

		collector.on('end', collected => {
			if (collected.size === 0) {
				embed.setDescription('Game timed out.');
				interaction.editReply({ embeds: [embed], components: [] });
			}
		});
		
		// optional (for card counting): when the "pile" has only 52 cards left, "enqueue" 52 shuffled cards

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
				if (['J', 'Q', 'K'].includes(card[1])) {
					hardVal += 10;
				} else if (card[1] == 'A') {
					aceCount += 1;
					hardVal += 11
				} else {
					hardVal += parseInt(card[1])
				}
			})

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

		// updateBal(win): updates the balance of the user based on whether win is true or false
		function updateBal(win) {
			if (win != null) {
				let delta = win ? betAmount : -betAmount;
				updateBalance(id, delta)
			}
		}
	},
};