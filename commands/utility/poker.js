const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { retrieveBalance, updateBalance } = require('../../sqlite');

module.exports = {
    data: new SlashCommandBuilder()
		.setName('poker')
		.setDescription('3-Card Poker')
        .addNumberOption(option =>
            option.setName("ante")
                .setDescription("How much do you want to place on ante?")
                .setRequired(true)
                .setMinValue(1))
        .addNumberOption(option =>
            option.setName("pair-plus")
                .setDescription("How much you want to place on pair-plus? (Enter 0 if you do not want to play pair-plus)")
                .setRequired(true)
                .setMinValue(0)),

    async execute(interaction) {
        const name = interaction.member.nickname ? interaction.member.nickname : interaction.user.username;
        const avatar = interaction.user.displayAvatarURL();
        const userId = interaction.user.id;
        
        let balance = await retrieveBalance(userId);
        const ante = interaction.options.getNumber("ante");
        const pairPlus = interaction.options.getNumber("pair-plus");
        const total = ante * 2 + pairPlus;

        if (total > balance) {
		    await interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({
                    name: name,
                    iconURL: avatar
                })
                .setTitle("Not enough money")
                .setDescription(`You don't have enough money to wager this amount!`)
                .setFooter({ text: `Balance: ${balance}🥛` })
            ]});
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({
                name: name,
                iconURL: avatar
            })
            .setTitle('3 Hand Poker')
            .setDescription(`Ante: ${ante}\nPair-Plus: ${pairPlus}`);
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play')
                    .setLabel('Play')
                    .setStyle('Primary'),
                new ButtonBuilder()
                    .setCustomId('fold')
                    .setLabel('Fold')
                    .setStyle('Secondary')
            )

        // instantiate the deck
		const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
		const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const winning_hands = ['High', 'Pair', 'Flush', 'Straight', 'Three of a Kind', 'Straight Flush'];
        const ante_bonus = [0, 0, 0, 1, 4, 5];
        const pair_bonus = [0, 1, 3, 6, 30, 40]
		let deck = [];

		suits.forEach(suit => {
			ranks.forEach(rank => {
				deck.push({ suit, rank });
			})
		});

		deck = deck.sort(() => Math.random() - 0.5);

        let playerHand = [];
		let dealerHand = [];

		for (let i = 0; i < 3; i++) {
			playerHand.push(drawCard());
			dealerHand.push(drawCard());
		}

        playerHand.sort((a, b) => ranks.indexOf(a.rank) - ranks.indexOf(b.rank))
        dealerHand.sort((a, b) => ranks.indexOf(a.rank) - ranks.indexOf(b.rank))

        embed.addFields(
			{ name: 'Your Hand', value: formatHand(playerHand), inline: false },
		);

        // console.log(playerHand)
        // console.log(`Checking Pair: ` + checkPair(playerHand))
        // console.log(`Checking Flush: ` + checkFlush(playerHand))
        // console.log(`Checking Straight: ` + checkStraight(playerHand))
        // console.log(`Checking Three of a Kind: ` + checkTriple(playerHand))
        // console.log(`Checking Straight Flush: ` + checkStraightFlush(playerHand))


        await interaction.reply({ embeds: [embed], components: [row]});

        const filter = i => i.user.id === interaction.user.id;
		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
        collector.on('collect', async i => {
            if (i.customId === 'play') {
                let player = handValue(playerHand);
                const playerHandIndex = winning_hands.indexOf(player)
                let dealer = handValue(dealerHand);
                const dealerHandIndex = winning_hands.indexOf(dealer)
                const playerHighest = (playerHand[0].rank === 'A') ? 13 : ranks.indexOf(playerHand[2].rank)
                const dealerHighest = (dealerHand[0].rank === 'A') ? 13 : ranks.indexOf(dealerHand[2].rank)
                
                
                let description;
                let net = 0;
                if (dealer === 'High' && dealerHighest < 11) { 
                    // Dealer does not qualify if hand is worse than Queen High
                    // Payout => Ante 1 : 1
                    embed.setTitle('Dealer does not qualify. No action')
                    description = `Ante: **+${ante}:milk:**\n`;
                    net += ante;
                } else {
                    if (playerHandIndex < dealerHandIndex) {
                        net -= ante * 2;
                        embed.setTitle('You lose the hand.');
                        description = `Ante: **-${ante * 2}:milk:**\n`;
                    } else if (playerHandIndex > dealerHandIndex){
                        embed.setTitle('You win the hand!');
                        description = `Ante: **+${ante * 2}:milk:**\n`;
                        net += ante * 2;
                    } else {
                        if (player === 'High' && dealer === 'High') {
                            if (playerHighest > dealerHighest) {
                                embed.setTitle('You win the hand!')
                                description = `Ante: **+${ante * 2}:milk:**\n`;
                                net += ante * 2;
                            } else if (playerHighest < dealerHighest) {
                                embed.setTitle('You win the hand');
                                description = `Ante: **-${ante * 2}:milk:**\n`;
                                net -= ante * 2;
                            } else {
                                embed.setTitle('You push');
                                description = `Ante: **N/A**\n`;
                            }
                        } else {
                            embed.setTitle('You push');
                            description = `Ante: **N/A**\n`;
                        }

                    }
                }
                // Add Ante Bonus Payout
                let anteBonusPayout = '';
                if (ante_bonus[playerHandIndex] !== 0) {
                    anteBonusPayout = `Ante Bonus: **+${ante_bonus[playerHandIndex] * ante}:milk:** (${player} pays ${ante_bonus[playerHandIndex]} to 1)\n`
                    net += ante_bonus[playerHandIndex] * ante;
                } else {
                    anteBonusPayout = `Ante Bonus: **N/A** (You need a straight or higher)\n`
                }
                
                // Add Pair Plus Payout
                let pairPlusPayout = '';
                if (pairPlus !== 0) {
                    if (pair_bonus[playerHandIndex] !== 0) {
                        pairPlusPayout = `Pair Plus: **+${pair_bonus[playerHandIndex] * pairPlus}:milk:** (${player} pays ${pair_bonus[playerHandIndex]} to 1)\n`
                        net += pair_bonus[playerHandIndex] * pairPlus;
                    } else {
                        pairPlusPayout = `Pair Plus: **-${pairPlus}:milk:** (You need at least a pair)\n`
                        net -= pairPlus;
                    }   
                } else {
                    pairPlusPayout = 'Pair Plus: **N/A** (You did not bet on Pair Plus)\n'
                }

                //console.log(net)
                let netEarnings = '';
                if (net > 0) {
                    netEarnings = `Net Earnings: **+${net}:milk:**`
                } else {
                    netEarnings = `Net Earnings: **${net}:milk:**`
                }

                if (player == 'High') {
                    if (playerHand[0].rank === 'A') {
                        player = 'A High'
                    } else {
                        player = playerHand[2].rank + ' High'
                    }
                }

                if (dealer == 'High') {
                    if (dealerHand[0].rank === 'A') {
                        dealer = 'A High'
                    } else {
                        dealer = dealerHand[2].rank + ' High'
                    }
                }

                embed.setDescription('**Payouts:**\n' + description + anteBonusPayout + pairPlusPayout + netEarnings)
                embed.setFields(
                    { name: `Dealer\'s Hand: ${dealer}`, value: formatHand(dealerHand), inline: false },
                    { name: `Your Hand: ${player}`, value: formatHand(playerHand), inline: false },
                )
                balance = await updateBalance(userId, net);
                embed.setFooter({ text: `Balance: ${balance}🥛` });
                // TODO: embed the pair plus winnings
                
                try {
                    await i.update ({ embeds: [embed], components: [] });
                } catch (error) {
                    if (error.code === 10062) {
                        return;
                    }
                }
            } else if (i.customId === 'fold') {
                collector.stop()
                balance = await updateBalance(userId, -(ante + pairPlus));

                embed.setTitle("You lose. You folded.")
                embed.setFields(
                        { name: 'Dealer\'s Hand', value: formatHand(dealerHand), inline: false },
                        { name: 'Your Hand', value: formatHand(playerHand), inline: false },
                    )
                embed.setDescription(`**-${ante + pairPlus}:milk:**`)
                embed.setFooter({ text: `Balance: ${balance}🥛` })
                
                try {
                    await i.update ({ embeds: [embed], components: [] });
                } catch (error) {
                    if (error.code === 10062) {
                        return;
                    }
                }

            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                embed.setDescription('Game timed out.');
				interaction.editReply({ embeds: [embed], components: [] });
			}
        })
        
        function drawCard() {
			return deck.shift();
		}

        function formatHand(hand) {
			return hand.map(card => `${card.rank} :${card.suit}:`).join(', ');
		}

        function checkPair(hand) {
            return (hand[0].rank === hand[1].rank || hand[1].rank === hand[2].rank)
        }

        function checkFlush(hand) {
            return (hand[0].suit === hand[1].suit && hand[0].suit === hand[2].suit)
        }

        function checkStraight(hand) {
            const condition1 = (ranks.indexOf(hand[0].rank) - ranks.indexOf(hand[1].rank) === -1) && (ranks.indexOf(hand[1].rank) - ranks.indexOf(hand[2].rank) === -1)
            const condition2 = hand[0].rank === 'A' && hand[1].rank === 'Q' && hand[2].rank === 'K'
            return (condition1 || condition2)
        }

        function checkTriple(hand) {
            return (hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank)
        }

        function checkStraightFlush(hand) {
            return checkStraight(hand) && checkFlush(hand) 
        }

        function handValue(hand) {
            if (checkStraightFlush(hand)) {
                return 'Straight Flush';
            } else if (checkTriple (hand)) {
                return 'Three of a Kind';
            } else if (checkStraight(hand)) {
                return 'Straight';
            } else if (checkFlush(hand)) {
                return 'Flush';
            } else if (checkPair(hand)) {
                return 'Pair';
            }
            return 'High';
        }
    }
        
}