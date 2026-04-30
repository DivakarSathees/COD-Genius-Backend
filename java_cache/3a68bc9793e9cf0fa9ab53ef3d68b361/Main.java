import java.util.Scanner;

public class Main {
    public static String reverseWords(String input) {
        if (input == null || input.isEmpty() || input.length() > 500) {
            return "Invalid input";
        }
        String[] words = input.split(" ");
        StringBuilder result = new StringBuilder();
        for (int i = words.length - 1; i >= 0; i--) {
            result.append(words[i]);
            if (i > 0) {
                result.append(" ");
            }
        }
        return result.toString();
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) {
            System.out.println("Invalid input");
            return;
        }
        String input = sc.nextLine();
        if (input.length() == 0 || input.length() > 500) {
            System.out.println("Invalid input");
            return;
        }
        System.out.println(reverseWords(input));
    }
}