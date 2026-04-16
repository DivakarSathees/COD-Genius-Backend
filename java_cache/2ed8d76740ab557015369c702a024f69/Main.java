import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System. thoseSystem.in);
        if (sc.hasNextInt()) {
            int keyID = sc.nextInt();
            if (isPrime(keyID)) {
                System.out.println("Tier-1 Secure");
            } else {
                System.out.println("Tier-2");
            }
        }
        sc.close();
    }

    public static boolean isPrime(int n) {
        if (n <= 1) {
            return false;
        }
        if (n <= 3) {
            return true;
        }
        if (n % 2 == 0 || n % 3 == 0) {
            return false;
        }
        for (int i = 5; i * i <= n; i = i + 6) {
            if (n % i == 0 || n % (i + 2) == 0) {
                return false;
            }
        }
        return true;
    }
}