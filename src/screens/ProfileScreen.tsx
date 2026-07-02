import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile, CreditCard } from '../types';
import { creditCards } from '../data/creditCards';
import { useTheme, ThemeColors } from '../theme';

interface ProfileScreenProps {
  userProfile: UserProfile;
  onClose: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatCardName = (name: string, cardType: string) => {
  if ((cardType === 'Student' && name.includes('Student')) ||
    (cardType === 'Secured' && name.includes('Secured'))) {
    // Remove the type word and any extra spaces, including double spaces
    return name.replace(cardType, '')
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .replace(/\s+Card\s*$/, ' Card')  // Fix spacing around "Card" at the end
      .trim();
  }
  return name;
};

export default function ProfileScreen({ userProfile, onClose }: ProfileScreenProps) {
  const { colors, theme, toggleTheme } = useTheme();
  const styles = makeStyles(colors);
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const walletCards = creditCards.filter(card =>
    userProfile.favoriteCards.includes(card.id)
  );

  const totalAnnualFees = walletCards.reduce((sum, card) => sum + card.annualFee, 0);

  const renderRewards = (rewards: any[]) => {
    // Group rewards by rate
    const groupedRewards = rewards.reduce((acc, reward) => {
      const rate = reward.rate;
      if (!acc[rate]) {
        acc[rate] = [];
      }
      acc[rate].push(reward.category);
      return acc;
    }, {} as Record<number, string[]>);

    // Sort rates in descending order
    return Object.entries(groupedRewards)
      .sort(([rateA], [rateB]) => Number(rateB) - Number(rateA))
      .map(([rate, categories]) => (
        <Text key={rate} style={styles.rewardText}>• {rate}x {(categories as string[]).join(', ')}</Text>
      ));
  };

  const renderWalletCard = ({ item }: { item: CreditCard }) => (
    <TouchableOpacity
      style={styles.walletCard}
      onPress={() => setSelectedCard(item)}
    >
      <View style={styles.walletCardHeader}>
        <Text style={styles.walletCardName}>{formatCardName(item.name, item.cardType)}</Text>
        <Text style={styles.walletCardFee}>{item.annualFee > 0 ? `$${item.annualFee}/year` : 'No Annual Fee'}</Text>
      </View>

      {item.welcomeBonus && (
        <View style={styles.bonusBanner}>
          <Text style={styles.bonusText}>Bonus: {item.welcomeBonus.amount}</Text>
          <Text style={styles.bonusRequirement}>{item.welcomeBonus.requirement}</Text>
        </View>
      )}

      <View style={styles.rewardsContainer}>
        {renderRewards(item.rewards)}
      </View>
    </TouchableOpacity>
  );

  const CardDetailsModal = () => {
    if (!selectedCard) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedCard}
        onRequestClose={() => setSelectedCard(null)}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{formatCardName(selectedCard.name, selectedCard.cardType)}</Text>
                <Text style={styles.modalIssuer}>{selectedCard.issuer}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedCard(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.iconMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.cardTypeBadge,
            selectedCard.cardType === 'Travel' && styles.travelBadge,
            selectedCard.cardType === 'Cash Back' && styles.cashBackBadge,
            selectedCard.cardType === 'Business' && styles.businessBadge,
            selectedCard.cardType === 'Student' && styles.studentBadge,
            selectedCard.cardType === 'Secured' && styles.securedBadge,
            ]}>
              <Text style={styles.cardTypeText}>{selectedCard.cardType}</Text>
            </View>

            {selectedCard.welcomeBonus && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Welcome Bonus</Text>
                <View style={styles.bonusBanner}>
                  <Text style={styles.bonusText}>{selectedCard.welcomeBonus.amount}</Text>
                  <Text style={styles.bonusRequirement}>{selectedCard.welcomeBonus.requirement}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                if (!selectedCard.applicationLink.startsWith('https://')) {
                  Alert.alert('Invalid Link', 'This link cannot be opened safely.');
                  return;
                }
                Linking.openURL(selectedCard.applicationLink);
              }}
            >
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Rewards</Text>
              <View style={styles.rewardsContainer}>
                {renderRewards(selectedCard.rewards)}
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Benefits</Text>
              {selectedCard.benefits.map((benefit, index) => (
                <Text key={index} style={styles.benefitText}>• {benefit}</Text>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>APR</Text>
              <Text style={styles.aprText}>Purchase: {selectedCard.apr.purchase}%</Text>
              <Text style={styles.aprText}>Balance Transfer: {selectedCard.apr.balance}%</Text>
              <Text style={styles.aprText}>Cash Advance: {selectedCard.apr.cash}%</Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Credit Score</Text>
              <Text style={styles.creditScoreText}>Minimum Required: {selectedCard.creditScore.min}</Text>
              <Text style={styles.creditScoreText}>Recommended: {selectedCard.creditScore.recommended}+</Text>
            </View>

            <View style={styles.bottomPadding} />
            <Text style={styles.disclaimer}>Rates, fees, and offers as of March 2026. Card terms may change — verify details with issuer before applying.</Text>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.iconMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={38} color={colors.accent} />
          </View>
          <Text style={styles.name}>{userProfile.firstName} {userProfile.lastName}</Text>
          <Text style={styles.email}>{userProfile.email}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Credit Score</Text>
            <Text style={styles.statValue}>{userProfile.creditScore}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Member Since</Text>
            <Text style={styles.statValue}>{new Date(userProfile.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</Text>
          </View>
        </View>
      </View>

      <View style={styles.walletSection}>
        <View style={styles.walletHeader}>
          <Text style={styles.sectionTitle}>My Wallet</Text>
          <Text style={styles.totalFees}>Total Annual Fees: {formatCurrency(totalAnnualFees)}</Text>
        </View>
        <FlatList
          data={walletCards}
          renderItem={renderWalletCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyWallet}>No cards in wallet. Add cards by tapping the star icon on any card.</Text>
          }
        />
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.settingsRow}>
          <View style={styles.settingsRowLeft}>
            <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={18} color={colors.accent} style={styles.settingsIcon} />
            <Text style={styles.settingsLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={theme === 'dark' ? '#FFF' : '#FFF'}
          />
        </View>
      </View>

      <CardDetailsModal />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  profileSection: {
    backgroundColor: colors.background,
    padding: 20,
    marginBottom: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 14,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
  },
  walletSection: {
    backgroundColor: colors.background,
    padding: 16,
    marginBottom: 8,
  },
  settingsSection: {
    backgroundColor: colors.background,
    padding: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    marginRight: 10,
  },
  settingsLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
    color: colors.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalFees: {
    fontSize: 13,
    color: colors.textMuted,
  },
  walletCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    paddingRight: 8,
  },
  walletCardFee: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rewardsContainer: {
    marginTop: 8,
  },
  rewardText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  emptyWallet: {
    textAlign: 'center',
    color: colors.textDisabled,
    fontStyle: 'italic',
    padding: 24,
  },
  bonusBanner: {
    backgroundColor: colors.bonusBg,
    padding: 8,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.bonusBorder,
  },
  bonusText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 2,
  },
  bonusRequirement: {
    fontSize: 12,
    color: colors.textMuted,
  },
  applyButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    marginVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.modalBackground,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalIssuer: {
    fontSize: 14,
    color: colors.textMuted,
  },
  detailSection: {
    marginVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 14,
  },
  benefitText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 20,
  },
  aprText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  creditScoreText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  cardTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 14,
    backgroundColor: colors.badgeDefault,
  },
  travelBadge: {
    backgroundColor: '#0D3B2E',
    borderWidth: 1,
    borderColor: '#1A6B50',
  },
  cashBackBadge: {
    backgroundColor: '#0D2B3B',
    borderWidth: 1,
    borderColor: '#1A5A7A',
  },
  businessBadge: {
    backgroundColor: '#2B1A3B',
    borderWidth: 1,
    borderColor: '#5A3A7A',
  },
  studentBadge: {
    backgroundColor: '#2B1A00',
    borderWidth: 1,
    borderColor: '#7A5A00',
  },
  securedBadge: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#444',
  },
  cardTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CCC',
    letterSpacing: 0.3,
  },
  bottomPadding: {
    height: 40,
  },
  disclaimer: {
    fontSize: 11,
    color: colors.disclaimerText,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingBottom: 16,
    lineHeight: 16,
  },
});
