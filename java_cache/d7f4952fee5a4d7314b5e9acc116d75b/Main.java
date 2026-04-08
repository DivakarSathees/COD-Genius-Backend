import java.util.Scanner;

class Node {
    String trackingNumber;
    String deliveryStatus;
    Node next;

    Node(String trackingNumber, String deliveryStatus) {
        this.trackingNumber = trackingNumber;
        this.deliveryStatus = deliveryStatus;
        this.next = null;
    }
}

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        int n = scanner.nextInt();
        scanner.nextLine(); // consume newline

        Node head = null;
        Node tail = null;

        for (int i = 0; i < n; i++) {
            String trackingNumber = scanner.nextLine();
            String deliveryStatus = scanner.nextLine();

            Node newNode = new Node(trackingNumber, deliveryStatus);
            if (head == null) {
                head = newNode;
                tail = newNode;
            } else {
                tail.next = newNode;
                tail = newNode;
            }
        }

        Node current = head;
        while (current != null) {
            System.out.println("[Tracking Number: " + current.trackingNumber + ", Status: " + current.deliveryStatus + "]");
            current = current.next;
        }
    }
}