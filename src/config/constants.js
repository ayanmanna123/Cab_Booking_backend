export const USER_ROLES = {
  RIDER: 'rider',
  DRIVER: 'driver',
  ADMIN: 'admin'
};

export const RIDE_STATUS = {
  REQUESTED: 'REQUESTED',
  SEARCHING: 'SEARCHING',
  ACCEPTED: 'ACCEPTED',
  ARRIVING: 'ARRIVING',
  ARRIVED: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

export const PAYMENT_METHODS = {
  CARD: 'card',
  STRIPE: 'stripe',
  CASH: 'cash',
  WALLET: 'wallet'
};

export const SOS_STATUS = {
  TRIGGERED: 'TRIGGERED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED'
};

export const TICKET_CATEGORIES = {
  PAYMENT_ISSUE: 'PAYMENT_ISSUE',
  LOST_ITEM: 'LOST_ITEM',
  DRIVER_BEHAVIOR: 'DRIVER_BEHAVIOR',
  APP_BUG: 'APP_BUG',
  OTHER: 'OTHER'
};

export const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_USER_ROOM: 'join:user',
  JOIN_DRIVER_ROOM: 'join:driver',

  // Driver Location & Online Status
  DRIVER_LOCATION_UPDATE: 'driver:location_update',
  DRIVER_STATUS_TOGGLE: 'driver:status_toggle',
  NEARBY_DRIVERS: 'drivers:nearby',

  // Ride Booking Flow
  RIDE_REQUESTED: 'ride:requested',
  RIDE_SEARCHING: 'ride:searching',
  RIDE_NEW_OFFER: 'ride:new_offer',
  RIDE_ACCEPT: 'ride:accept',
  RIDE_ACCEPTED: 'ride:accepted',
  RIDE_DECLINE: 'ride:decline',
  RIDE_DRIVER_ARRIVING: 'ride:driver_arriving',
  RIDE_DRIVER_ARRIVED: 'ride:driver_arrived',
  RIDE_START: 'ride:start',
  RIDE_STARTED: 'ride:started',
  RIDE_COMPLETE: 'ride:complete',
  RIDE_COMPLETED: 'ride:completed',
  RIDE_CANCEL: 'ride:cancel',
  RIDE_CANCELLED: 'ride:cancelled',

  // Live GPS Tracking during ride
  RIDE_TRACK_LOCATION: 'ride:track_location',

  // SOS & Emergency
  SOS_TRIGGER: 'sos:trigger',
  SOS_ALERT_BROADCAST: 'sos:alert_broadcast'
};
