import { Platform, StatusBar, StyleSheet } from "react-native";

const topInset = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;
const bottomInset = Platform.OS === "android" ? 18 : 10;

const palette = {
  // Main brand colors
  emerald900: "#063B3A",
  emerald800: "#075E5B",
  emerald700: "#0B7A75",
  emerald600: "#159A9C",

  // Soft backgrounds
  mintWash: "#EAF8F6",
  mintSoft: "#F4FCFA",

  // Cream / sand colors
  ivory: "#FFF7E8",
  ivoryDeep: "#FFE7B8",
  gold: "#D99A2B",
  goldSoft: "#FFE6A3",

  // Accent colors
  coral: "#F26A3D",
  coralDark: "#B93A24",
  coralSoft: "#FFF0E6",

  // Text colors
  ink: "#102A2A",
  slate: "#6B7280",

  // Borders
  border: "#E6D7B8",
  borderSoft: "#D8E8E2",
  borderStrong: "#C9953D",

  white: "#FFFFFF",
};

export const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: palette.emerald900,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.mintWash,
  },

  authScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 24 + topInset,
    paddingBottom: 24 + bottomInset,
    backgroundColor: palette.mintWash,
  },

  authScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20,
  },

  authPanel: {
    gap: 14,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
  },

  brandMark: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: palette.gold,
    borderRadius: 8,
    backgroundColor: palette.emerald900,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },

  brandImage: {
    width: 70,
    height: 70,
  },

  brandText: {
    color: palette.white,
    fontSize: 20,
    fontWeight: "900",
  },

  authTitle: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: "900",
  },

  authTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  authTitleText: {
    flex: 1,
    gap: 6,
  },

  authCopy: {
    color: palette.slate,
    fontSize: 16,
    lineHeight: 24,
  },

  phoneShell: {
    flex: 1,
    alignSelf: "center",
    width: "100%",
    maxWidth: 430,
    backgroundColor: palette.mintWash,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20 + topInset,
    paddingBottom: 26,
    backgroundColor: palette.emerald900,
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  userEmail: {
    marginBottom: 6,
    color: palette.white,
    fontSize: 14,
    opacity: 0.9,
  },

  title: {
    color: palette.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0,
  },

  headerActions: {
    alignItems: "flex-end",
    gap: 10,
  },

  languageSwitch: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 184, 0.55)",
    borderRadius: 8,
    backgroundColor: "rgba(255, 250, 240, 0.12)",
  },

  languageButton: {
    minWidth: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  languageButtonActive: {
    backgroundColor: palette.ivory,
  },

  languageText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: "900",
  },

  languageTextActive: {
    color: palette.emerald900,
  },

  logoutButton: {
    minWidth: 72,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 231, 184, 0.65)",
    borderRadius: 8,
    backgroundColor: palette.ivory,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  logoutText: {
    color: palette.emerald800,
    fontSize: 15,
    fontWeight: "900",
  },

  content: {
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 104 + bottomInset,
  },

  card: {
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 8,
    backgroundColor: palette.white,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  statsCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },

  inlineStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  stat: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },

  statLabel: {
    color: palette.slate,
    fontSize: 12,
    minHeight: 30,
  },

  statValue: {
    color: palette.emerald900,
    fontSize: 19,
    fontWeight: "900",
  },

  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },

  helperText: {
    color: palette.slate,
    fontSize: 16,
    lineHeight: 24,
  },

  dashboardStatsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: -4,
  },

  dashboardStatCardLarge: {
    flex: 1.25,
    minHeight: 132,
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 8,
    backgroundColor: palette.emerald900,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  dashboardStatSide: {
    flex: 1,
    gap: 12,
  },

  dashboardMiniStatCard: {
    flex: 1,
    minHeight: 60,
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  dashboardStatLabel: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "800",
  },

  dashboardStatAmount: {
    color: palette.ivory,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
  },

  dashboardMiniStatValue: {
    color: palette.emerald900,
    fontSize: 28,
    fontWeight: "900",
  },

  monthlyCard: {
    gap: 20,
    padding: 22,
    borderRadius: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  monthlyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },

  monthlyTitle: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0,
  },

  monthlySubtitle: {
    marginTop: 8,
    color: palette.slate,
    fontSize: 16,
    lineHeight: 24,
  },

  monthlyIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.ivory,
    borderWidth: 1,
    borderColor: palette.border,
  },

  monthlyIconText: {
    color: palette.emerald900,
    fontSize: 24,
    fontWeight: "900",
  },

  monthlyCompareRow: {
    flexDirection: "row",
    gap: 12,
  },

  monthlyCompareItem: {
    flex: 1,
    gap: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: palette.mintSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },

  monthlyLabel: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "800",
  },

  monthlyMoney: {
    color: palette.emerald900,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },

  monthlyBarTrack: {
    height: 9,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#DDEDEA",
  },

  monthlyBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.emerald700,
  },

  monthlyBarFillSoft: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.gold,
  },

  monthChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  monthChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: palette.ivory,
    borderWidth: 1,
    borderColor: palette.border,
  },

  monthChipActive: {
    backgroundColor: palette.emerald900,
    borderColor: palette.emerald900,
  },

  monthChipText: {
    color: palette.emerald900,
    fontSize: 13,
    fontWeight: "900",
  },

  monthChipTextActive: {
    color: palette.ivory,
  },

  emptyMonthBox: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: palette.ivory,
    borderWidth: 1,
    borderColor: palette.border,
  },

  emptyMonthText: {
    color: palette.slate,
    fontSize: 15,
    lineHeight: 22,
  },

  recentInvoicesCard: {
    gap: 8,
    padding: 22,
    borderRadius: 8,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  recentInvoicesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  recentInvoicesTitle: {
    color: palette.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 0,
  },

  recentInvoicesCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    textAlign: "center",
    textAlignVertical: "center",
    color: palette.emerald900,
    backgroundColor: palette.ivory,
    fontSize: 14,
    fontWeight: "900",
    overflow: "hidden",
  },

  // FORMS / BUTTONS

  field: {
    gap: 8,
  },

  label: {
    color: palette.emerald700,
    fontSize: 13,
    fontWeight: "700",
  },

  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.ivory,
    color: palette.ink,
    fontSize: 16,
  },

  primaryButton: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: palette.coral,
    shadowColor: palette.coral,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  primaryPressed: {
    backgroundColor: palette.coralDark,
  },

  primaryText: {
    color: palette.white,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  disabled: {
    opacity: 0.65,
  },

  linkButton: {
    alignSelf: "center",
    paddingVertical: 8,
  },

  linkText: {
    color: palette.emerald700,
    fontSize: 15,
    fontWeight: "800",
  },

  authLinks: {
    gap: 2,
    alignItems: "center",
  },

  authLanguageSwitch: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.ivory,
  },

  authLanguageButton: {
    minWidth: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  authLanguageButtonActive: {
    backgroundColor: palette.emerald900,
  },

  authLanguageText: {
    color: palette.emerald900,
    fontSize: 12,
    fontWeight: "900",
  },

  authLanguageTextActive: {
    color: palette.white,
  },

  errorText: {
    color: palette.coralDark,
  },

  statusText: {
    color: palette.slate,
    fontSize: 15,
  },

  // SCAN SCREEN

  scanGrid: {
    gap: 10,
  },

  actionTile: {
    gap: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 8,
    backgroundColor: palette.white,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  pressed: {
    opacity: 0.75,
  },

  actionTitle: {
    color: palette.emerald900,
    fontSize: 17,
    fontWeight: "900",
  },

  actionCopy: {
    color: palette.slate,
    fontSize: 14,
  },

  selectedFile: {
    gap: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.ivory,
  },

  selectedLabel: {
    color: palette.slate,
    fontSize: 12,
  },

  selectedName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },

  segmented: {
    flexDirection: "row",
    minHeight: 44,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.ivory,
  },

  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  segmentButtonActive: {
    backgroundColor: palette.emerald700,
  },

  segmentText: {
    color: palette.slate,
    fontSize: 14,
    fontWeight: "900",
  },

  segmentTextActive: {
    color: palette.white,
  },

  manualForm: {
    gap: 14,
  },

  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoryChip: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    backgroundColor: palette.ivory,
  },

  categoryChipActive: {
    borderColor: palette.coral,
    backgroundColor: palette.coralSoft,
  },

  categoryChipText: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "900",
  },

  categoryChipTextActive: {
    color: palette.coralDark,
  },

  manualItem: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.ivory,
  },

  manualItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  twoColumn: {
    flexDirection: "row",
    gap: 10,
  },

  flexInput: {
    flex: 1,
    minWidth: 0,
  },

  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.emerald700,
    borderRadius: 8,
    backgroundColor: palette.white,
  },

  secondaryText: {
    color: palette.emerald700,
    fontSize: 15,
    fontWeight: "900",
  },

  smallButton: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: palette.goldSoft,
  },

  smallButtonText: {
    color: palette.emerald800,
    fontSize: 12,
    fontWeight: "900",
  },

  actionRow: {
    gap: 6,
  },

  // PRO CARD

  proCard: {
    borderColor: palette.border,
    backgroundColor: palette.white,
    marginTop: 20,
  },

  proCardActive: {
    borderColor: palette.gold,
    backgroundColor: palette.ivory,
    marginTop: 18,
  },

  proHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 18,
  },

  proBadge: {
    maxWidth: 118,
    paddingHorizontal: 8,
    paddingVertical: 7,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: palette.goldSoft,
    color: palette.emerald900,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },

  // INVOICE LIST

  invoiceCard: {
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },

  invoiceSummary: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
  },

  invoiceText: {
    flex: 1,
    gap: 4,
  },

  invoiceTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },

  invoiceMeta: {
    color: palette.slate,
    fontSize: 13,
  },

  invoiceAmount: {
    color: palette.emerald800,
    fontSize: 17,
    fontWeight: "900",
    maxWidth: 120,
    textAlign: "right",
  },

  itemList: {
    gap: 10,
    paddingBottom: 14,
    paddingLeft: 12,
  },

  retryPanel: {
    gap: 10,
    paddingBottom: 14,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },

  itemName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },

  itemPrice: {
    color: palette.emerald800,
    fontSize: 15,
    fontWeight: "900",
  },

  // CATEGORIES

  categoryRow: {
    gap: 10,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },

  categoryRowSelected: {
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: palette.ivory,
  },

  categoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  categoryName: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
  },

  categoryCount: {
    color: palette.slate,
    fontSize: 13,
  },

  categoryAmount: {
    color: palette.emerald800,
    fontSize: 16,
    fontWeight: "900",
    maxWidth: 110,
    textAlign: "right",
  },

  categoryBar: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: palette.goldSoft,
  },

  categoryFill: {
    height: "100%",
    borderRadius: 999,
  },

  // EMPTY STATE

  emptyState: {
    gap: 8,
    paddingVertical: 24,
    alignItems: "center",
  },

  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyCopy: {
    color: palette.slate,
    textAlign: "center",
    lineHeight: 22,
  },

  // BOTTOM NAV

  nav: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    minHeight: 78 + bottomInset,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: bottomInset,
    backgroundColor: palette.emerald900,
    shadowColor: palette.emerald900,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },

  navButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },

  navButtonActive: {
    backgroundColor: palette.ivory,
  },

  navText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  navTextActive: {
    color: palette.emerald900,
  },
});
