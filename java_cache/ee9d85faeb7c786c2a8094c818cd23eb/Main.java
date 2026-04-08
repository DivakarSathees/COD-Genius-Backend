import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) {
            return;
        }
        int n = sc.nextInt();
        int m = sc.nextInt();
        ParkingLot lot = new ParkingLot(n);
        for (int i = 0; i < m; i++) {
            if (!sc.hasNext()) break;
            String vehicleID = sc.next();
            String plateNumber = sc.next();
            String type = sc.next();
            Vehicle v = new Vehicle(vehicleID, plateNumber, type);
            int spot = lot.parkVehicle(v);
            boolean parked = spot != -1;
            System.out.println("VehicleID: " + vehicleID + ", Parked: " + parked + ", Spot: " + spot);
        }
        lot.printStatus();
        sc.close();
    }
}

class Vehicle {
    private String vehicleID;
    private String plateNumber;
    private String type;

    public Vehicle(String vehicleID, String plateNumber, String type) {
        this.vehicleID = vehicleID;
        this.plateNumber = plateNumber;
        this.type = type;
    }

    public String getVehicleID() {
        return vehicleID;
    }

    public String getPlateNumber() {
        return plateNumber;
    }

    public String getType() {
        return type;
    }
}

class ParkingSpot {
    private int spotID;
    private boolean occupied;
    private Vehicle vehicle;

    public ParkingSpot(int spotID) {
        this.spotID = spotID;
        this.occupied = false;
        this.vehicle = null;
    }

    public int getSpotID() {
        return spotID;
    }

    public boolean isOccupied() {
        return occupied;
    }

    public Vehicle getVehicle() {
        return vehicle;
    }

    public void park(Vehicle v) {
        this.vehicle = v;
        this.occupied = true;
    }

    public void remove() {
        this.vehicle = null;
        this.occupied = false;
    }
}

class ParkingLot {
    private List<ParkingSpot> spots;

    public ParkingLot(int n) {
        spots = new ArrayList<>();
        for (int i = 1; i <= n; i++) {
            spots.add(new ParkingSpot(i));
        }
    }

    public int parkVehicle(Vehicle v) {
        for (ParkingSpot spot : spots) {
            if (!spot.isOccupied()) {
                spot.park(v);
                return spot.getSpotID();
            }
        }
        return -1;
    }

    public boolean removeVehicle(String vehicleID) {
        for (ParkingSpot spot : spots) {
            if (spot.isOccupied() && spot.getVehicle().getVehicleID().equals(vehicleID)) {
                spot.remove();
                return true;
            }
        }
        return false;
    }

    public void printStatus() {
        for (ParkingSpot spot : spots) {
            String vid = "None";
            boolean occ = spot.isOccupied();
            if (occ && spot.getVehicle() != null) {
                vid = spot.getVehicle().getVehicleID();
            }
            System.out.println("Spot " + spot.getSpotID() + ": Occupied: " + occ + ", VehicleID: " + vid);
        }
    }
}
