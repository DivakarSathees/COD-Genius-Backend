import java.util.*;

public class Main {
    static class Show {
        String showID;
        String title;
        int seatsAvailable;

        Show(String showID, String title, int seatsAvailable) {
            this.showID = showID;
            this.title = title;
            this.seatsAvailable = seatsAvailable;
        }
    }

    static class BookingRequest {
        String bookingID;
        String showID;
        int seatsRequested;

        BookingRequest(String bookingID, String showID, int seatsRequested) {
            this.bookingID = bookingID;
            this.showID = showID;
            this.seatsRequested = seatsRequested;
        }
    }

    static class Theater {
        private final List<Show> shows = new ArrayList<>();
        private final Map<String, Show> showMap = new HashMap<>();

        void addShow(Show show) {
            shows.add(show);
            showMap.put(show.showID, show);
        }

        /**
         * Attempts to process the booking. Returns true if booking succeeded and reduces seats.
         */
        boolean processBooking(BookingRequest req) {
            Show s = showMap.get(req.showID);
            if (s == null) return false;
            if (req.seatsRequested <= s.seatsAvailable && req.seatsRequested >= 0) {
                s.seatsAvailable -= req.seatsRequested;
                return true;
            }
            return false;
        }

        void printShows() {
            for (Show s : shows) {
                System.out.println("ShowID: " + s.showID + ", Title: " + s.title + ", SeatsAvailable: " + s.seatsAvailable);
            }
        }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Theater theater = new Theater();

        if (!sc.hasNextInt()) {
            // No input; nothing to do
            return;
        }

        int S = sc.nextInt();
        for (int i = 0; i < S; i++) {
            String showID = sc.next();
            String title = sc.next();
            int seats = 0;
            if (sc.hasNextInt()) seats = sc.nextInt();
            Show show = new Show(showID, title, seats);
            theater.addShow(show);
        }

        int B = 0;
        if (sc.hasNextInt()) {
            B = sc.nextInt();
        }

        List<BookingRequest> requests = new ArrayList<>();
        for (int i = 0; i < B; i++) {
            if (!sc.hasNext()) break;
            String bookingID = sc.next();
            String targetShowID = sc.hasNext() ? sc.next() : "";
            int seatsReq = 0;
            if (sc.hasNextInt()) seatsReq = sc.nextInt();
            requests.add(new BookingRequest(bookingID, targetShowID, seatsReq));
        }

        for (BookingRequest req : requests) {
            boolean success = theater.processBooking(req);
            int seatsBooked = success ? req.seatsRequested : 0;
            System.out.println("BookingID: " + req.bookingID + ", Success: " + String.valueOf(success) + ", SeatsBooked: " + seatsBooked);
        }

        theater.printShows();
    }
}
