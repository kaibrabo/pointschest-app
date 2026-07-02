import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
  Linking,
  Alert,
  useWindowDimensions,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { creditCards } from "../src/data/creditCards";
import { CreditCard, UserProfile, Reward } from "../src/types";
import { useState, useMemo, useRef, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import ProfileScreen from "../src/screens/ProfileScreen";
import { useTheme } from "../src/theme";

// Temporary user profile (in a real app, this would come from a backend)
const initialUserProfile: UserProfile = {
  id: "1",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  creditScore: 750,
  monthlySpend: {
    dining: 500,
    groceries: 600,
    gas: 200,
    travel: 300,
    other: 1000,
  },
  favoriteCards: [],
  joinDate: "2024-01-01",
};

export default function Index() {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const numWebColumns = isWeb
    ? windowWidth >= 1200
      ? 3
      : windowWidth >= 720
        ? 2
        : 1
    : 1;
  const webCardWidth = isWeb
    ? Math.floor((windowWidth - 48) / numWebColumns) - 8
    : 0;
  const styles = makeStyles(colors);
  const [searchQuery, setSearchQuery] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [userProfile, setUserProfile] =
    useState<UserProfile>(initialUserProfile);
  const [committedFavorites, setCommittedFavorites] = useState<string[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const { height: screenHeight } = Dimensions.get("window");

  useEffect(() => {
    AsyncStorage.getItem("favoriteCards").then((stored) => {
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        setUserProfile((prev) => ({ ...prev, favoriteCards: ids }));
        setCommittedFavorites(ids);
      }
    });
  }, []);

  // Re-sort when returning from profile
  useEffect(() => {
    if (!showProfile) {
      setCommittedFavorites(userProfile.favoriteCards);
    }
  }, [showProfile]);

  // Re-sort when search query changes
  useEffect(() => {
    setCommittedFavorites(userProfile.favoriteCards);
  }, [searchQuery]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const keyboardHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, []);

  const handleSearchFocus = () => {
    if (Platform.OS === "ios") {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const getRewardRate = (card: CreditCard, searchTerm: string) => {
    // Find matching category based on search term
    const searchLower = searchTerm.toLowerCase();
    let matchingCategory = "";

    // Check if search term matches any of our mapped categories
    const categoryMapping: { [key: string]: string[] } = {
      gas: ["gas", "fuel", "gasoline"],
      grocery: ["grocery", "groceries", "supermarket", "supermarkets"],
      food: ["food", "dining", "restaurant", "restaurants"],
      travel: ["travel", "airline", "hotel", "flight"],
      entertainment: ["entertainment", "streaming", "movie"],
    };
    for (const [category, terms] of Object.entries(categoryMapping)) {
      if (terms.some((term) => searchLower.includes(term))) {
        matchingCategory = category;
        break;
      }
    }

    // Find the highest reward rate for the matching category
    let maxRate = 0;
    card.rewards.forEach((reward) => {
      const rewardCategory = reward.category.toLowerCase();

      // Check if this reward matches our search category
      const isMatch = matchingCategory
        ? categoryMapping[matchingCategory].some((term) =>
            rewardCategory.includes(term),
          )
        : rewardCategory.includes(searchLower);

      if (isMatch && reward.rate > maxRate) {
        maxRate = reward.rate;
      }
    });

    return maxRate;
  };

  const toggleFavorite = (cardId: string) => {
    setUserProfile((prev) => {
      const isFavorite = prev.favoriteCards.includes(cardId);
      const updated = isFavorite
        ? prev.favoriteCards.filter((id) => id !== cardId)
        : [...prev.favoriteCards, cardId];
      AsyncStorage.setItem("favoriteCards", JSON.stringify(updated));
      return { ...prev, favoriteCards: updated };
    });
  };

  const sortedCards = useMemo(() => {
    if (!searchQuery) {
      return [...creditCards].sort((a, b) => {
        const aIsFavorite = committedFavorites.includes(a.id);
        const bIsFavorite = committedFavorites.includes(b.id);

        // First, sort by favorites
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;

        // Then sort by annual fee (highest to lowest)
        if (a.annualFee !== b.annualFee) {
          return b.annualFee - a.annualFee;
        }

        // If annual fees are equal, sort by issuer name
        return a.issuer.localeCompare(b.issuer);
      });
    }

    const searchLower = searchQuery.toLowerCase();

    // Sort by reward rate and favorites for search results
    return [...creditCards].sort((a, b) => {
      const rateA = getRewardRate(a, searchLower);
      const rateB = getRewardRate(b, searchLower);
      if (rateB !== rateA) {
        return rateB - rateA;
      }
      // If rates are equal, check favorites
      const aIsFavorite = committedFavorites.includes(a.id);
      const bIsFavorite = committedFavorites.includes(b.id);
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      // If both/neither are favorites, sort by annual fee
      return b.annualFee - a.annualFee;
    });
  }, [searchQuery, committedFavorites]);

  const handleApply = (applicationLink: string) => {
    if (!applicationLink.startsWith("https://")) {
      Alert.alert("Invalid Link", "This link cannot be opened safely.");
      return;
    }
    Linking.openURL(applicationLink);
  };

  const formatCardName = (name: string, cardType: string) => {
    if (
      (cardType === "Student" && name.includes("Student")) ||
      (cardType === "Secured" && name.includes("Secured"))
    ) {
      // Remove the type word and any extra spaces, including double spaces
      return name
        .replace(cardType, "")
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .replace(/\s+Card\s*$/, " Card") // Fix spacing around "Card" at the end
        .trim();
    }
    return name;
  };

  const renderRewards = (rewards: Reward[]) => {
    // Group rewards by rate
    const groupedRewards = rewards.reduce(
      (acc, reward) => {
        const rate = reward.rate;
        if (!acc[rate]) {
          acc[rate] = [];
        }
        acc[rate].push(reward.category);
        return acc;
      },
      {} as Record<number, string[]>,
    );

    // Sort rates in descending order
    return Object.entries(groupedRewards)
      .sort(([rateA], [rateB]) => Number(rateB) - Number(rateA))
      .map(([rate, categories]) => (
        <Text key={rate} style={styles.rewardText}>
          • {rate}x {categories.join(", ")}
        </Text>
      ));
  };

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
                <Text style={styles.modalTitle}>
                  {formatCardName(selectedCard.name, selectedCard.cardType)}
                </Text>
                <Text style={styles.modalIssuer}>{selectedCard.issuer}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedCard(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.iconMuted} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.cardTypeBadge,
                selectedCard.cardType === "Travel" && styles.travelBadge,
                selectedCard.cardType === "Cash Back" && styles.cashBackBadge,
                selectedCard.cardType === "Business" && styles.businessBadge,
                selectedCard.cardType === "Student" && styles.studentBadge,
                selectedCard.cardType === "Secured" && styles.securedBadge,
              ]}
            >
              <Text style={styles.cardTypeText}>{selectedCard.cardType}</Text>
            </View>

            {selectedCard.welcomeBonus && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Welcome Bonus</Text>
                <View style={styles.bonusBanner}>
                  <Text style={styles.bonusText}>
                    {selectedCard.welcomeBonus.amount}
                  </Text>
                  <Text style={styles.bonusRequirement}>
                    {selectedCard.welcomeBonus.requirement}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={() => toggleFavorite(selectedCard.id)}
                style={styles.favoriteButton}
              >
                <Ionicons
                  name={
                    userProfile.favoriteCards.includes(selectedCard.id)
                      ? "star"
                      : "star-outline"
                  }
                  size={24}
                  color={
                    userProfile.favoriteCards.includes(selectedCard.id)
                      ? colors.accent
                      : colors.textDisabled
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => handleApply(selectedCard.applicationLink)}
              >
                <Text style={styles.applyButtonText}>Apply Now</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Rewards</Text>
              <View style={styles.rewardsContainer}>
                {renderRewards(selectedCard.rewards)}
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Benefits</Text>
              {selectedCard.benefits.map((benefit, index) => (
                <Text key={index} style={styles.benefitText}>
                  • {benefit}
                </Text>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>APR</Text>
              <Text style={styles.aprText}>
                Purchase: {selectedCard.apr.purchase}%
              </Text>
              <Text style={styles.aprText}>
                Balance Transfer: {selectedCard.apr.balance}%
              </Text>
              <Text style={styles.aprText}>
                Cash Advance: {selectedCard.apr.cash}%
              </Text>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Credit Score</Text>
              <Text style={styles.creditScoreText}>
                Minimum Required: {selectedCard.creditScore.min}
              </Text>
              <Text style={styles.creditScoreText}>
                Recommended: {selectedCard.creditScore.recommended}+
              </Text>
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderCard = ({ item }: { item: CreditCard }) => {
    const rewardRate = searchQuery ? getRewardRate(item, searchQuery) : 0;
    const isFavorite = userProfile.favoriteCards.includes(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.card,
          isFavorite && styles.favoriteCard,
          isWeb && { width: webCardWidth },
        ]}
        onPress={() => setSelectedCard(item)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardName}>
              {formatCardName(item.name, item.cardType)}
            </Text>
            <Text style={styles.issuer}>{item.issuer}</Text>
          </View>
          <View
            style={[
              styles.cardTypeBadge,
              item.cardType === "Travel" && styles.travelBadge,
              item.cardType === "Cash Back" && styles.cashBackBadge,
              item.cardType === "Business" && styles.businessBadge,
              item.cardType === "Student" && styles.studentBadge,
              item.cardType === "Secured" && styles.securedBadge,
            ]}
          >
            <Text style={styles.cardTypeText}>{item.cardType}</Text>
          </View>
        </View>

        {item.welcomeBonus && (
          <View style={styles.bonusBanner}>
            <Text style={styles.bonusText}>
              Bonus: {item.welcomeBonus.amount}
            </Text>
            <Text style={styles.bonusRequirement}>
              {item.welcomeBonus.requirement}
            </Text>
          </View>
        )}

        <View style={styles.rewardsContainer}>
          {renderRewards(item.rewards)}
        </View>

        {!!searchQuery && rewardRate > 0 && (
          <Text style={styles.matchedReward}>
            {rewardRate}x points on "{searchQuery}"
          </Text>
        )}

        {isWeb && item.benefits.length > 0 && (
          <View style={styles.webBenefitsSection}>
            <Text style={styles.webBenefitsTitle}>Top Benefits</Text>
            {item.benefits.slice(0, 3).map((benefit, index) => (
              <Text key={index} style={styles.webBenefitText}>
                • {benefit}
              </Text>
            ))}
          </View>
        )}

        {isWeb && (
          <View style={styles.webMetaRow}>
            <View style={styles.webMetaItem}>
              <Text style={styles.webMetaLabel}>Purchase APR</Text>
              <Text style={styles.webMetaValue}>{item.apr.purchase}%</Text>
            </View>
            <View style={styles.webMetaItem}>
              <Text style={styles.webMetaLabel}>Min Credit</Text>
              <Text style={styles.webMetaValue}>{item.creditScore.min}+</Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.annualFee}>
            {item.annualFee > 0
              ? `$${item.annualFee} Annual Fee`
              : "No Annual Fee"}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => toggleFavorite(item.id)}
              style={styles.favoriteButton}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={24}
                color={isFavorite ? colors.accent : colors.textDisabled}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => handleApply(item.applicationLink)}
            >
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {showProfile ? (
        <ProfileScreen
          userProfile={userProfile}
          onClose={() => setShowProfile(false)}
        />
      ) : (
        <>
          {isWeb ? (
            <View style={styles.webNavContainer}>
              <View style={styles.webNavbar}>
                <View style={styles.logoRow}>
                  <Image
                    source={require("../assets/images/black_chest_logo.png")}
                    style={styles.logoImg}
                  />
                  <Text style={styles.header}>PointsChest</Text>
                </View>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => setShowProfile(true)}
                >
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={18} color={colors.accent} />
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.webSearchWrapper}>
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.textMuted}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.webSearchInput}
                  placeholder="Search cards by category, rewards, or benefits..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.textDisabled}
                  autoCorrect={false}
                  returnKeyType="search"
                  id="searchInput"
                />
                {!!searchQuery && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.headerContainer}>
              <View style={styles.logoRow}>
                <Image
                  source={require("../assets/images/black_chest_logo.png")}
                  style={styles.logoImg}
                />
                <Text style={styles.header}>PointsChest</Text>
              </View>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => setShowProfile(true)}
              >
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={18} color={colors.accent} />
                </View>
              </TouchableOpacity>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 20}
          >
            {isWeb ? (
              <ScrollView contentContainerStyle={styles.webListContent}>
                <View style={styles.webGrid}>
                  {sortedCards.map((item) => renderCard({ item }))}
                </View>
                <Text style={styles.disclaimer}>
                  Rates, fees, and offers as of March 2026. Verify details with
                  issuer before applying.
                </Text>
              </ScrollView>
            ) : (
              <FlatList
                data={sortedCards}
                renderItem={renderCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                  styles.list,
                  keyboardVisible && {
                    paddingBottom: keyboardHeight + 120,
                  },
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScrollBeginDrag={() => {
                  if (!keyboardVisible) return;
                  Keyboard.dismiss();
                }}
                ListFooterComponent={
                  <Text style={styles.disclaimer}>
                    Rates, fees, and offers as of March 2026. Verify details
                    with issuer before applying.
                  </Text>
                }
              />
            )}
            {!isWeb && (
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <View
                  style={[
                    styles.searchContainer,
                    {
                      bottom: keyboardVisible
                        ? Platform.OS === "ios"
                          ? keyboardHeight - 35
                          : keyboardHeight
                        : 0,
                    },
                  ]}
                >
                  <View style={styles.searchInputWrapper}>
                    <Ionicons
                      name="search"
                      size={16}
                      color="#555"
                      style={styles.searchIcon}
                    />
                    <TextInput
                      ref={searchInputRef}
                      style={styles.searchInput}
                      placeholder="Search cards, rewards, or benefits..."
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholderTextColor={colors.textDisabled}
                      onFocus={handleSearchFocus}
                      autoCorrect={false}
                      returnKeyType="search"
                      enablesReturnKeyAutomatically
                    />
                  </View>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
          <CardDetailsModal />
        </>
      )}
    </SafeAreaView>
  );
}

import { ThemeColors } from "../src/theme";

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    webNavContainer: {
      flexDirection: "column",
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    logoImg: {
      width: 28,
      height: 28,
      resizeMode: "contain",
      borderRadius: 6,
    },
    webNavbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      justifyContent: "space-between",
    },
    webSearchWrapper: {
      maxWidth: 1200,
      marginTop: 20,
      marginRight: "auto",
      marginBottom: 10,
      marginLeft: "auto",
      width: "100%",
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.searchBar,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    webSearchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
    },
    header: {
      fontSize: 22,
      fontWeight: "bold",
      color: colors.accent,
      letterSpacing: 0.5,
    },
    avatarCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    profileButton: {
      padding: 2,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    closeButton: {
      padding: 8,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    list: {
      padding: 16,
      paddingBottom: 88,
    },
    searchContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surfaceSecondary,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 5,
    },
    searchInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.searchBar,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      paddingVertical: 10,
      fontSize: 15,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
    },
    cardName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 3,
      flex: 1,
      paddingRight: 8,
    },
    issuer: {
      fontSize: 13,
      color: colors.textMuted,
    },
    cardTypeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.badgeDefault,
    },
    travelBadge: {
      backgroundColor: "#0D3B2E",
      borderWidth: 1,
      borderColor: "#1A6B50",
    },
    cashBackBadge: {
      backgroundColor: "#0D2B3B",
      borderWidth: 1,
      borderColor: "#1A5A7A",
    },
    businessBadge: {
      backgroundColor: "#2B1A3B",
      borderWidth: 1,
      borderColor: "#5A3A7A",
    },
    studentBadge: {
      backgroundColor: "#2B1A00",
      borderWidth: 1,
      borderColor: "#7A5A00",
    },
    securedBadge: {
      backgroundColor: "#1E1E1E",
      borderWidth: 1,
      borderColor: "#444",
    },
    cardTypeText: {
      color: "#CCC",
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    rewardsContainer: {
      marginBottom: 12,
    },
    rewardText: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 2,
    },
    matchedReward: {
      fontSize: 14,
      color: colors.accent,
      fontWeight: "600",
      marginBottom: 10,
    },
    footer: {
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    actionButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    favoriteButton: {
      padding: 4,
    },
    applyButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    applyButtonText: {
      color: "#000",
      fontWeight: "700",
      fontSize: 13,
    },
    annualFee: {
      fontSize: 13,
      color: colors.textMuted,
    },
    favoriteCard: {
      borderColor: colors.accent,
      borderWidth: 1,
    },
    bonusBanner: {
      backgroundColor: colors.bonusBg,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.bonusBorder,
    },
    bonusText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
      marginBottom: 2,
    },
    bonusRequirement: {
      fontSize: 12,
      color: colors.textMuted,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      justifyContent: "flex-end",
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
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "bold",
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
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 10,
      color: colors.accent,
      letterSpacing: 0.8,
      textTransform: "uppercase",
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
    bottomPadding: {
      height: 40,
    },
    disclaimer: {
      fontSize: 11,
      color: colors.disclaimerText,
      textAlign: "center",
      paddingHorizontal: 8,
      paddingVertical: 16,
      lineHeight: 16,
    },
    webListContent: {
      padding: 16,
      paddingBottom: 88,
    },
    webGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "center",
    },
    webBenefitsSection: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    webBenefitsTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    webBenefitText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 3,
      lineHeight: 17,
    },
    webMetaRow: {
      flexDirection: "row",
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    webMetaItem: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      padding: 8,
      alignItems: "center",
    },
    webMetaLabel: {
      fontSize: 10,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    webMetaValue: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
  });
