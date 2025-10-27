<?php
// send-employee-email.php - COLOCAR EN LA RAIZ DE TU SITIO WEB
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

// Obtener datos JSON
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['email']) || !isset($data['fullName'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Datos incompletos']);
    exit;
}

// Datos del empleado
$to = filter_var($data['email'], FILTER_SANITIZE_EMAIL);
$fullName = filter_var($data['fullName'], FILTER_SANITIZE_STRING);
$employeeId = filter_var($data['employeeId'], FILTER_SANITIZE_STRING);
$role = filter_var($data['role'], FILTER_SANITIZE_STRING);
$hireDate = filter_var($data['hireDate'], FILTER_SANITIZE_STRING);

// Template del email
$subject = "Welcome to Sherpa Delivery Direct - $fullName";

$message = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Welcome to Sherpa Delivery Direct</title>
</head>
<body style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;'>
    <div style='text-align: center; background: #2c3e50; color: white; padding: 15px; border-radius: 10px 10px 0 0;'>
        <h1>Sherpa Delivery Direct, LLC</h1>
    </div>
    <div style='padding: 20px;'>
        <h2 style='color: #2c3e50;'>Welcome to Our Team!</h2>
        <p>Dear <strong>$fullName</strong>,</p>
        <p>Your employee account has been successfully created. Here are your details:</p>
        
        <table style='width: 100%; border-collapse: collapse; margin: 15px 0; background: #f8f9fa; padding: 15px; border-radius: 5px;'>
            <tr>
                <td style='padding: 8px; border-bottom: 1px solid #ddd;'><strong>Employee ID:</strong></td>
                <td style='padding: 8px; border-bottom: 1px solid #ddd;'>$employeeId</td>
            </tr>
            <tr>
                <td style='padding: 8px; border-bottom: 1px solid #ddd;'><strong>Full Name:</strong></td>
                <td style='padding: 8px; border-bottom: 1px solid #ddd;'>$fullName</td>
            </tr>
            <tr>
                <td style='padding: 8px; border-bottom: 1px solid #ddd;'><strong>Position:</strong></td>
                <td style='padding: 8px; border-bottom: 1px solid #ddd;'>$role</td>
            </tr>
            <tr>
                <td style='padding: 8px;'><strong>Hire Date:</strong></td>
                <td style='padding: 8px;'>$hireDate</td>
            </tr>
        </table>
        
        <p style='margin-top: 20px;'>If you have any questions, please contact HR.</p>
        
        <div style='margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px;'>
            <p>Best regards,<br>
            <strong>Sherpa Delivery Direct Team</strong><br>
            sherpadeliverydirect.com</p>
        </div>
    </div>
</body>
</html>
";

// Headers para email HTML
$headers = "From: noreply@sherpadeliverydirect.com\r\n";
$headers .= "Reply-To: noreply@sherpadeliverydirect.com\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "MIME-Version: 1.0\r\n";

// Enviar email
if (mail($to, $subject, $message, $headers)) {
    echo json_encode(['success' => true, 'message' => 'Email enviado exitosamente']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error al enviar email']);
}
?>