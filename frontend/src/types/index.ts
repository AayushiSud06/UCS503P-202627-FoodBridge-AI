// ─── Core Status Enum ───────────────────────────────────────────────────────

export type DonationStatus =
  | 'AVAILABLE'
  | 'MATCHED'
  | 'ACCEPTED'
  | 'VOLUNTEER_ASSIGNED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type FoodCategory =
  | 'Vegetarian'
  | 'Non-Vegetarian'
  | 'Bakery'
  | 'Fruits & Vegetables'
  | 'Packaged Food'
  | 'Other';

export type FoodUnit = 'Meals' | 'Kg' | 'Boxes' | 'Pieces';
export type StorageType = 'Room Temperature' | 'Refrigerated' | 'Frozen' | 'Other';

export type UserRole = 'donor' | 'ngo' | 'volunteer' | 'admin';

// ─── Domain Entities ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  organization?: string;
}

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  donorOrganization: string;
  foodName: string;
  category: FoodCategory;
  quantity: number;
  unit: FoodUnit;
  preparedAt: string;       // "HH:MM" 24h or display string
  pickupDeadline: string;   // "HH:MM" or display string
  location: string;
  description: string;
  storageType: StorageType;
  imagePreview?: string;    // base64 or URL
  status: DonationStatus;
  createdAt: string;        // ISO date string
  recipientId?: string;
  recipientName?: string;
  volunteerId?: string;
  volunteerName?: string;
  matchScore?: number;      // 0-100, currently mock/rule-based
  distanceKm?: number;
  // Timeline timestamps
  matchedAt?: string;
  acceptedAt?: string;
  volunteerAssignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  completedAt?: string;
}

export interface Recipient {
  id: string;
  name: string;
  type: string;
  location: string;
  capacity: number;   // max meals they can handle
  distanceKm: number;
  reliabilityScore: number;  // 0-100
  acceptedDonations: number;
  contactPerson: string;
  phone: string;
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
  location: string;
  distanceKm: number;
  completedDeliveries: number;
  activeDeliveries: number;
  rating: number; // 1-5
  isAvailable: boolean;
}

export interface Delivery {
  id: string;
  donationId: string;
  volunteerId: string;
  pickupLocation: string;
  dropoffLocation: string;
  distanceKm: number;
  estimatedMinutes: number;
  status: DonationStatus;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

export interface MatchAnalysis {
  overallScore: number;
  distanceScore: number;
  quantityScore: number;
  capacityScore: number;
  pickupAvailabilityScore: number;
  reliabilityScore: number;
  reasons: string[];
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'donation_created' | 'donation_accepted' | 'volunteer_assigned' | 'picked_up' | 'delivered' | 'completed' | 'donor_registered';
  message: string;
  donationId?: string;
}

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

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppStats {
  totalDonations: number;
  totalMeals: number;
  completedDonations: number;
  activeDonations: number;
  totalOrganizations: number;
  totalVolunteers: number;
  successfulPickups: number;
}
