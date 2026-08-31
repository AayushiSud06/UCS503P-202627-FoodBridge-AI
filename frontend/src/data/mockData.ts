import type {
  User, Donation, Recipient, Volunteer, ActivityLog, AppStats, MatchAnalysis
} from '../types';

// ─── Users ───────────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  {
    id: 'u-donor-1',
    name: 'Aayushi Sharma',
    email: 'aayushi@thapar.edu',
    role: 'donor',
    avatarInitials: 'AS',
    organization: 'College Central Mess',
  },
  {
    id: 'u-donor-2',
    name: 'Vikram Mehta',
    email: 'vikram@grandorchid.com',
    role: 'donor',
    avatarInitials: 'VM',
    organization: 'Grand Orchid Banquets',
  },
  {
    id: 'u-ngo-1',
    name: 'Raj Malhotra',
    email: 'raj@helpinghands.org',
    role: 'ngo',
    avatarInitials: 'RM',
    organization: 'Helping Hands Community Kitchen',
  },
  {
    id: 'u-ngo-2',
    name: 'Priya Singh',
    email: 'priya@umeedshelter.org',
    role: 'ngo',
    avatarInitials: 'PS',
    organization: 'Umeed Shelter & Care',
  },
  {
    id: 'u-volunteer-1',
    name: 'Aarav Sharma',
    email: 'aarav@thapar.edu',
    role: 'volunteer',
    avatarInitials: 'AS',
    organization: undefined,
  },
  {
    id: 'u-volunteer-2',
    name: 'Meera Kapoor',
    email: 'meera@gmail.com',
    role: 'volunteer',
    avatarInitials: 'MK',
    organization: undefined,
  },
  {
    id: 'u-admin-1',
    name: 'Admin Controller',
    email: 'admin@foodlink.ai',
    role: 'admin',
    avatarInitials: 'AD',
    organization: 'FoodLink AI Operations',
  },
];

// ─── Recipients / NGOs ────────────────────────────────────────────────────────

export const MOCK_RECIPIENTS: Recipient[] = [
  {
    id: 'r-1',
    name: 'Helping Hands Community Kitchen',
    type: 'Community Kitchen',
    location: 'Sector 38, Chandigarh',
    capacity: 150,
    distanceKm: 1.8,
    reliabilityScore: 95,
    acceptedDonations: 48,
    contactPerson: 'Raj Malhotra',
    phone: '+91-98765-43210',
  },
  {
    id: 'r-2',
    name: 'Umeed Shelter & Care',
    type: 'Shelter Home',
    location: 'Phase 7, Mohali',
    capacity: 80,
    distanceKm: 3.2,
    reliabilityScore: 89,
    acceptedDonations: 29,
    contactPerson: 'Priya Singh',
    phone: '+91-87654-32109',
  },
  {
    id: 'r-3',
    name: 'Rotary Club Food Mission',
    type: 'NGO Distribution',
    location: 'Zirakpur Bypass',
    capacity: 220,
    distanceKm: 5.5,
    reliabilityScore: 92,
    acceptedDonations: 64,
    contactPerson: 'Sunil Verma',
    phone: '+91-76543-21098',
  },
  {
    id: 'r-4',
    name: 'Apna Ghar Senior Living',
    type: 'Old Age Home',
    location: 'Sector 15, Panchkula',
    capacity: 60,
    distanceKm: 4.1,
    reliabilityScore: 97,
    acceptedDonations: 21,
    contactPerson: 'Gurpreet Kaur',
    phone: '+91-99887-65432',
  },
  {
    id: 'r-5',
    name: 'Seva Bal Ashram',
    type: 'Children Welfare Center',
    location: 'Urban Estate, Patiala',
    capacity: 100,
    distanceKm: 2.4,
    reliabilityScore: 94,
    acceptedDonations: 37,
    contactPerson: 'Raman Deep',
    phone: '+91-98123-45678',
  },
];

// ─── Volunteers ───────────────────────────────────────────────────────────────

export const MOCK_VOLUNTEERS: Volunteer[] = [
  {
    id: 'v-1',
    name: 'Aarav Sharma',
    phone: '+91-98001-23456',
    location: 'Thapar University Campus',
    distanceKm: 0.8,
    completedDeliveries: 18,
    activeDeliveries: 1,
    rating: 4.9,
    isAvailable: true,
  },
  {
    id: 'v-2',
    name: 'Meera Kapoor',
    phone: '+91-97001-34567',
    location: 'Model Town, Patiala',
    distanceKm: 2.1,
    completedDeliveries: 14,
    activeDeliveries: 0,
    rating: 4.7,
    isAvailable: true,
  },
  {
    id: 'v-3',
    name: 'Karanvir Dhillon',
    phone: '+91-98712-34567',
    location: 'Leela Bhawan, Patiala',
    distanceKm: 1.5,
    completedDeliveries: 22,
    activeDeliveries: 0,
    rating: 4.95,
    isAvailable: true,
  },
  {
    id: 'v-4',
    name: 'Simranjeet Kaur',
    phone: '+91-99123-87654',
    location: 'Urban Estate Phase 2',
    distanceKm: 3.0,
    completedDeliveries: 9,
    activeDeliveries: 1,
    rating: 4.6,
    isAvailable: false,
  },
];

// ─── Donations ────────────────────────────────────────────────────────────────

export const INITIAL_DONATIONS: Donation[] = [
  {
    id: 'don-001',
    donorId: 'u-donor-1',
    donorName: 'Aayushi Sharma',
    donorOrganization: 'College Central Mess',
    foodName: 'Vegetarian Meals',
    category: 'Vegetarian',
    quantity: 50,
    unit: 'Meals',
    preparedAt: '1:00 PM',
    pickupDeadline: '8:00 PM',
    location: 'College Central Mess, Thapar University',
    description: 'Nutritious balanced meals with dal makhani, paneer bhurji, 4 rotis, jeera rice, and salad. Packed in hygienic thermal boxes.',
    storageType: 'Room Temperature',
    status: 'MATCHED',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    recipientId: 'r-1',
    recipientName: 'Helping Hands Community Kitchen',
    matchScore: 94,
    distanceKm: 1.8,
    matchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: 'don-002',
    donorId: 'u-donor-1',
    donorName: 'Aayushi Sharma',
    donorOrganization: 'College Central Mess',
    foodName: 'Fresh Sandwich & Snack Boxes',
    category: 'Vegetarian',
    quantity: 25,
    unit: 'Boxes',
    preparedAt: '3:30 PM',
    pickupDeadline: '6:30 PM',
    location: 'College Cafeteria, Block C',
    description: 'Assorted vegetable & cheese grilled sandwiches with fruit juice packs from seminar break.',
    storageType: 'Refrigerated',
    status: 'AVAILABLE',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    matchScore: 88,
    distanceKm: 1.8,
  },
  {
    id: 'don-003',
    donorId: 'u-donor-1',
    donorName: 'Aayushi Sharma',
    donorOrganization: 'Tech Fest Organizing Committee',
    foodName: 'Meal Combos (Veg & Non-Veg)',
    category: 'Non-Vegetarian',
    quantity: 45,
    unit: 'Meals',
    preparedAt: '12:00 PM',
    pickupDeadline: '4:00 PM',
    location: 'TF Arena Ground, Thapar University',
    description: 'Surplus meal packets from hackathon closing ceremony. Clearly separated and sealed.',
    storageType: 'Room Temperature',
    status: 'VOLUNTEER_ASSIGNED',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    recipientId: 'r-2',
    recipientName: 'Umeed Shelter & Care',
    volunteerId: 'v-2',
    volunteerName: 'Meera Kapoor',
    matchScore: 86,
    distanceKm: 3.2,
    matchedAt: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    volunteerAssignedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'don-004',
    donorId: 'u-donor-1',
    donorName: 'Aayushi Sharma',
    donorOrganization: 'Campus Bakery & Patisserie',
    foodName: 'Artisan Bread Rolls & Pastries',
    category: 'Bakery',
    quantity: 60,
    unit: 'Pieces',
    preparedAt: '7:00 AM',
    pickupDeadline: '11:00 AM',
    location: 'Bakery Counter, Block A',
    description: 'Freshly baked multigrain dinner rolls, croissants, and banana bread loaves.',
    storageType: 'Room Temperature',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    recipientId: 'r-5',
    recipientName: 'Seva Bal Ashram',
    volunteerId: 'v-1',
    volunteerName: 'Aarav Sharma',
    matchScore: 96,
    distanceKm: 2.4,
    matchedAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    volunteerAssignedAt: new Date(Date.now() - 22.5 * 60 * 60 * 1000).toISOString(),
    pickedUpAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    deliveredAt: new Date(Date.now() - 21.5 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 21.4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'don-005',
    donorId: 'u-donor-2',
    donorName: 'Vikram Mehta',
    donorOrganization: 'Grand Orchid Banquets',
    foodName: 'Buffet Main Course Surplus',
    category: 'Vegetarian',
    quantity: 80,
    unit: 'Meals',
    preparedAt: '2:00 PM',
    pickupDeadline: '5:30 PM',
    location: 'Grand Orchid, VIP Road, Zirakpur',
    description: 'Untouched hot buffet trays including Shahi Paneer, Pulao, Dal Tadka, and Butter Roti in industrial warming containers.',
    storageType: 'Room Temperature',
    status: 'ACCEPTED',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    recipientId: 'r-3',
    recipientName: 'Rotary Club Food Mission',
    matchScore: 91,
    distanceKm: 5.5,
    matchedAt: new Date(Date.now() - 2.8 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 2.2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'don-006',
    donorId: 'u-donor-1',
    donorName: 'Aayushi Sharma',
    donorOrganization: 'College Central Mess',
    foodName: 'Seasonal Fruit Crates',
    category: 'Fruits & Vegetables',
    quantity: 35,
    unit: 'Kg',
    preparedAt: '9:00 AM',
    pickupDeadline: '1:00 PM',
    location: 'Mess Store Room, Basement 1',
    description: 'Crates of Kinnow oranges, apples, and bananas in fresh, ripe condition.',
    storageType: 'Refrigerated',
    status: 'PICKED_UP',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    recipientId: 'r-4',
    recipientName: 'Apna Ghar Senior Living',
    volunteerId: 'v-1',
    volunteerName: 'Aarav Sharma',
    matchScore: 93,
    distanceKm: 4.1,
    matchedAt: new Date(Date.now() - 3.8 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    volunteerAssignedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    pickedUpAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'don-007',
    donorId: 'u-donor-2',
    donorName: 'Vikram Mehta',
    donorOrganization: 'Green Grocers Mart',
    foodName: 'Packaged Biscuits & Dry Ration Kits',
    category: 'Packaged Food',
    quantity: 40,
    unit: 'Boxes',
    preparedAt: '10:00 AM',
    pickupDeadline: '6:00 PM',
    location: 'Green Grocers Hub, Sector 22',
    description: 'Sealed biscuit cartons, oats packets, and roasted snacks near best-before date but 100% wholesome.',
    storageType: 'Room Temperature',
    status: 'AVAILABLE',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    matchScore: 85,
    distanceKm: 3.5,
  },
];

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const INITIAL_ACTIVITY: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    type: 'donation_created',
    message: 'AI matched 50 Vegetarian Meals with Helping Hands Community Kitchen (94% score)',
    donationId: 'don-001',
  },
  {
    id: 'act-2',
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    type: 'volunteer_assigned',
    message: 'Volunteer Meera Kapoor assigned to Pickup #don-003 for Umeed Shelter',
    donationId: 'don-003',
  },
  {
    id: 'act-3',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    type: 'picked_up',
    message: 'Volunteer Aarav Sharma picked up 35 Kg Fruit Crates from College Central Mess',
    donationId: 'don-006',
  },
  {
    id: 'act-4',
    timestamp: new Date(Date.now() - 2.2 * 60 * 60 * 1000).toISOString(),
    type: 'donation_accepted',
    message: 'Rotary Club Food Mission accepted 80 Meals from Grand Orchid Banquets',
    donationId: 'don-005',
  },
  {
    id: 'act-5',
    timestamp: new Date(Date.now() - 21.4 * 60 * 60 * 1000).toISOString(),
    type: 'completed',
    message: 'Donation #don-004 (60 Bakery Pieces) delivered to Seva Bal Ashram',
    donationId: 'don-004',
  },
];

// ─── Initial App Stats ────────────────────────────────────────────────────────

export const INITIAL_STATS: AppStats = {
  totalDonations: 124,
  totalMeals: 4890,
  completedDonations: 98,
  activeDonations: 6,
  totalOrganizations: 32,
  totalVolunteers: 56,
  successfulPickups: 114,
};

// ─── NGO Food Demands / Requirements ──────────────────────────────────────────

export interface NGORequirement {
  id: string;
  ngoId: string;
  ngoName: string;
  foodType: string;
  quantityNeeded: number;
  unit: string;
  beneficiaryCount: number;
  urgency: 'High' | 'Medium' | 'Low';
  dailyRecurring: boolean;
  notes: string;
}

export const INITIAL_REQUIREMENTS: NGORequirement[] = [
  {
    id: 'req-1',
    ngoId: 'r-1',
    ngoName: 'Helping Hands Community Kitchen',
    foodType: 'Cooked Lunch / Vegetarian Thali',
    quantityNeeded: 120,
    unit: 'Meals',
    beneficiaryCount: 150,
    urgency: 'High',
    dailyRecurring: true,
    notes: 'Daily mid-day meal program for daily-wage migrant families.',
  },
  {
    id: 'req-2',
    ngoId: 'r-2',
    ngoName: 'Umeed Shelter & Care',
    foodType: 'Dinner Meals (Veg or Non-Veg)',
    quantityNeeded: 60,
    unit: 'Meals',
    beneficiaryCount: 75,
    urgency: 'High',
    dailyRecurring: true,
    notes: 'Evening shelter food needed before 8:30 PM.',
  },
  {
    id: 'req-3',
    ngoId: 'r-5',
    ngoName: 'Seva Bal Ashram',
    foodType: 'Fresh Fruits & Morning Bakery/Milk',
    quantityNeeded: 40,
    unit: 'Kg',
    beneficiaryCount: 85,
    urgency: 'Medium',
    dailyRecurring: false,
    notes: 'Nutrition boost for school-age children in residential care.',
  },
];

// ─── Rule-Based Match Scoring Function ────────────────────────────────────────

/**
 * Computes deterministic multi-criteria AI match analysis between donation & recipient.
 * Structure designed for seamless upgrade to FastAPI / PyTorch ML inference endpoint.
 */
export function computeMockMatchScore(
  donationQuantity: number,
  recipientCapacity: number,
  distanceKm: number,
  reliabilityScore: number,
): MatchAnalysis {
  const distanceScore = Math.max(20, Math.round(100 - distanceKm * 7.5));
  const quantityScore = donationQuantity <= recipientCapacity
    ? Math.round(92 + Math.min(7, (recipientCapacity - donationQuantity) / 15))
    : Math.max(30, Math.round(100 - (donationQuantity - recipientCapacity) * 0.6));
  const capacityScore = Math.min(99, Math.round((recipientCapacity / Math.max(donationQuantity, 1)) * 55 + 40));
  const pickupScore = 90;
  const relScore = reliabilityScore;

  const overall = Math.round(
    distanceScore * 0.25 +
    quantityScore * 0.25 +
    capacityScore * 0.20 +
    pickupScore * 0.15 +
    relScore * 0.15
  );

  const reasons: string[] = [];
  if (distanceScore >= 80) reasons.push(`Recipient is within quick response range (${distanceKm.toFixed(1)} km)`);
  if (quantityScore >= 85) reasons.push(`Quantity (${donationQuantity}) is highly compatible with recipient demand`);
  if (capacityScore >= 80) reasons.push(`Recipient has adequate cold/ambient capacity (${recipientCapacity} meals)`);
  if (pickupScore >= 80) reasons.push('Pickup window aligns with active volunteer route coverage');
  if (relScore >= 85) reasons.push(`Recipient maintains a verified reliability score of ${relScore}%`);

  return {
    overallScore: Math.min(98, Math.max(65, overall)),
    distanceScore,
    quantityScore,
    capacityScore,
    pickupAvailabilityScore: pickupScore,
    reliabilityScore: relScore,
    reasons,
  };
}
