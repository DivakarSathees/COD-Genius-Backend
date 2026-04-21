import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int n = scanner.nextInt();
        scanner.nextLine();
        Map<String, Book> books = new HashMap<>();

        for (int i = 0; i < n; i++) {
            String[] line = scanner.nextLine().split(" ");
            String operation = line[0];

            if (operation.equals("add")) {
                String isbn = line[1];
                String title = line[2];
                String author = line[3];
                books.put(isbn, new Book(isbn, title, author));
                System.out.println("Book added: ISBN " + isbn + ", Title: " + title + ", Author: " + author);
            } else if (operation.equals("borrow") || operation.equals("return")) {
                String isbn = line[1];
                if (books.containsKey(isbn)) {
                    Book book = books.get(isbn);
                    book.setStatus(operation.equals("borrow") ? "borrowed" : "available");
                    System.out.println("Book ISBN " + isbn + " marked as " + book.getStatus());
                } else {
                    System.out.println("Invalid ISBN");
                }
            } else if (operation.equals("display")) {
                for (Book book : books.values()) {
                    System.out.println("ISBN: " + book.getIsbn() + ", Title: " + book.getTitle() + ", Author: " + book.getAuthor() + ", Status: " + book.getStatus());
                }
            }
        }
        scanner.close();
    }
}

class Book {
    private String isbn;
    private String title;
    private String author;
    private String status;

    public Book(String isbn, String title, String author) {
        this.isbn = isbn;
        this.title = title;
        this.author = author;
        this.status = "available";
    }

    public String getIsbn() {
        return isbn;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}