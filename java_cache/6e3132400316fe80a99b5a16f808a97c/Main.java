import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) {
            System.out.println("Present Students:");
            System.out.println("None");
            System.out.println("Absent Students:");
            System.out.println("None");
            return;
        }
        int n = sc.nextInt();
        sc.nextLine();
        List<String> present = new ArrayList<>();
        List<String> absent = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String line = "";
            while (line.isEmpty() && sc.hasNextLine()) {
                line = sc.nextLine().trim();
            }
            if (line.isEmpty()) {
                continue;
            }
            String[] tokens = line.split("\\s+");
            if (tokens.length == 1) {
                String name = tokens[0];
                absent.add(name);
            } else {
                String status = tokens[tokens.length - 1].toLowerCase();
                String name = String.join(" ", Arrays.copyOfRange(tokens, 0, tokens.length - 1));
                if (isPresent(status)) {
                    present.add(name);
                } else {
                    absent.add(name);
                }
            }
        }
        System.out.println("Present Students:");
        if (present.isEmpty()) {
            System.out.println("None");
        } else {
            for (String s : present) System.out.println(s);
        }
        System.out.println("Absent Students:");
        if (absent.isEmpty()) {
            System.out.println("None");
        } else {
            for (String s : absent) System.out.println(s);
        }
    }

    private static boolean isPresent(String status) {
        return status.equals("present") || status.equals("p") || status.equals("yes") || status.equals("y") || status.equals("1") || status.equals("true");
    }
}
